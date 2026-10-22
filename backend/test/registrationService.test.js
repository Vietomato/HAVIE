import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegistrationService,
  hashOtp,
  isOtpMatch,
} from '../src/services/registrationService.js';

function setEnvironment(values) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function createFakeDatabase() {
  const state = { user: null, challenge: null };
  const database = {
    user: {
      findUnique: async () => state.user,
    },
    emailVerificationChallenge: {
      deleteMany: async ({ where }) => {
        if (where.id && state.challenge?.id !== where.id) return { count: 0 };
        if (where.expiresAt && state.challenge?.expiresAt > where.expiresAt.lte) {
          return { count: 0 };
        }
        state.challenge = null;
        return { count: 1 };
      },
      findUnique: async () => state.challenge,
      upsert: async ({ create, update }) => {
        state.challenge = {
          id: 'challenge-id',
          attempts: 0,
          ...(state.challenge ? update : create),
        };
        return { id: state.challenge.id };
      },
      updateMany: async ({ where, data }) => {
        if (!state.challenge || state.challenge.id !== where.id || state.challenge.attempts >= where.attempts.lt) {
          return { count: 0 };
        }
        state.challenge.attempts += data.attempts.increment;
        return { count: 1 };
      },
      delete: async () => {
        state.challenge = null;
      },
    },
    $transaction: async (callback) =>
      callback({
        user: {
          create: async ({ data }) => {
            state.user = {
              id: 'user-id',
              ...data,
              isActive: true,
            };
            return state.user;
          },
        },
        emailVerificationChallenge: {
          delete: async () => {
            state.challenge = null;
          },
        },
      }),
  };
  return { database, state };
}

test('OTP hashes cannot be used as the original code and compare in constant-time-safe helper', () => {
  const hash = hashOtp('user@example.com', '004219', 'fixed-test-secret');
  assert.notEqual(hash, '004219');
  assert.equal(isOtpMatch('user@example.com', '004219', hash, 'fixed-test-secret'), true);
  assert.equal(isOtpMatch('user@example.com', '004218', hash, 'fixed-test-secret'), false);
  assert.equal(isOtpMatch('other@example.com', '004219', hash, 'fixed-test-secret'), false);
});

test('email verification creates a customer account only after a valid OTP', async () => {
  const restore = setEnvironment({
    JWT_SECRET: 'registration-test-secret-with-at-least-32-bytes',
    OTP_HASH_SECRET: 'otp-test-secret-with-at-least-32-bytes',
    JWT_EXPIRES_IN: '1h',
    ADMIN_EMAIL_ALLOWLIST: '',
  });
  try {
    const { database, state } = createFakeDatabase();
    let sentCode;
    const service = createRegistrationService({
      database,
      hashPassword: async (password) => `bcrypt:${password}`,
      otpFactory: () => '003517',
      sendOtp: async ({ code }) => {
        sentCode = code;
      },
    });

    await service.requestOtp({
      fullName: 'Customer',
      email: 'customer@example.com',
      phone: '',
      password: 'secret1',
    });
    assert.equal(sentCode, '003517');
    assert.notEqual(state.challenge.otpHash, sentCode);

    await assert.rejects(
      service.verifyOtp({ email: 'customer@example.com', code: '000000' }),
      (error) => error.code === 'OTP_INVALID',
    );
    assert.equal(state.challenge.attempts, 1);

    const result = await service.verifyOtp({ email: 'customer@example.com', code: sentCode });
    assert.equal(result.data.user.role, 'CUSTOMER');
    assert.equal(result.data.user.email, 'customer@example.com');
    assert.equal('passwordHash' in result.data.user, false);
    assert.equal(state.challenge, null);
  } finally {
    restore();
  }
});

test('a verified allowlisted address gets Admin role; other addresses cannot self-assign roles', async () => {
  const restore = setEnvironment({
    JWT_SECRET: 'registration-test-secret-with-at-least-32-bytes',
    OTP_HASH_SECRET: 'otp-test-secret-with-at-least-32-bytes',
    JWT_EXPIRES_IN: '1h',
    ADMIN_EMAIL_ALLOWLIST: ' admin@example.com ',
  });
  try {
    const { database, state } = createFakeDatabase();
    const service = createRegistrationService({
      database,
      hashPassword: async (password) => `bcrypt:${password}`,
      otpFactory: () => '123456',
      sendOtp: async () => {},
    });
    await service.requestOtp({
      fullName: 'Allowlisted Admin',
      email: 'ADMIN@example.com',
      password: 'secret1',
      role: 'CUSTOMER',
    });

    const result = await service.verifyOtp({ email: 'admin@example.com', code: '123456' });
    assert.equal(result.data.user.role, 'ADMIN');
    assert.equal(result.data.user.isActive, true);
    assert.equal(state.challenge, null);
  } finally {
    restore();
  }
});

test('a resend during the cooldown is rejected without sending another message', async () => {
  const restore = setEnvironment({
    OTP_HASH_SECRET: 'otp-test-secret-with-at-least-32-bytes',
  });
  try {
    const { database } = createFakeDatabase();
    let sends = 0;
    const service = createRegistrationService({
      database,
      hashPassword: async () => 'password-hash',
      otpFactory: () => '654321',
      sendOtp: async () => {
        sends += 1;
      },
    });
    const payload = {
      fullName: 'Customer',
      email: 'customer@example.com',
      password: 'secret1',
    };

    await service.requestOtp(payload);
    await assert.rejects(
      service.requestOtp(payload),
      (error) => error.code === 'OTP_RATE_LIMITED' && error.details.retryAfterSeconds === 60,
    );
    assert.equal(sends, 1);
  } finally {
    restore();
  }
});

test('expired OTPs cannot create an account', async () => {
  const restore = setEnvironment({
    OTP_HASH_SECRET: 'otp-test-secret-with-at-least-32-bytes',
  });
  try {
    const { database, state } = createFakeDatabase();
    let now = new Date('2026-01-01T00:00:00.000Z');
    const service = createRegistrationService({
      database,
      hashPassword: async () => 'password-hash',
      otpFactory: () => '987654',
      sendOtp: async () => {},
      clock: () => now,
    });

    await service.requestOtp({
      fullName: 'Customer',
      email: 'customer@example.com',
      password: 'secret1',
    });
    now = new Date(now.getTime() + 10 * 60 * 1000);

    await assert.rejects(
      service.verifyOtp({ email: 'customer@example.com', code: '987654' }),
      (error) => error.code === 'OTP_INVALID_OR_EXPIRED',
    );
    assert.equal(state.user, null);
    assert.equal(state.challenge, null);
  } finally {
    restore();
  }
});

test('OTP verification is locked after five incorrect attempts', async () => {
  const restore = setEnvironment({
    OTP_HASH_SECRET: 'otp-test-secret-with-at-least-32-bytes',
  });
  try {
    const { database, state } = createFakeDatabase();
    const service = createRegistrationService({
      database,
      hashPassword: async () => 'password-hash',
      otpFactory: () => '987654',
      sendOtp: async () => {},
    });
    await service.requestOtp({
      fullName: 'Customer',
      email: 'customer@example.com',
      password: 'secret1',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        service.verifyOtp({ email: 'customer@example.com', code: '000000' }),
        (error) => error.code === 'OTP_INVALID',
      );
    }
    assert.equal(state.challenge.attempts, 5);
    await assert.rejects(
      service.verifyOtp({ email: 'customer@example.com', code: '987654' }),
      (error) => error.code === 'OTP_ATTEMPTS_EXCEEDED',
    );
    assert.equal(state.user, null);
    assert.equal(state.challenge, null);
  } finally {
    restore();
  }
});
