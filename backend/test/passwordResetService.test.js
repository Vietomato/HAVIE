import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordResetService } from '../src/services/passwordResetService.js';
import { hashOtp } from '../src/services/registrationService.js';

const SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';
process.env.OTP_HASH_SECRET = SECRET;

function createFakeDatabase(initialUser = { id: 'user-id', isActive: true, passwordHash: 'old' }) {
  const state = { user: initialUser, challenge: null };
  const database = {
    user: {
      findUnique: async () => state.user,
    },
    passwordResetChallenge: {
      deleteMany: async ({ where }) => {
        if (where.id && state.challenge?.id !== where.id) return { count: 0 };
        if (where.expiresAt && state.challenge?.expiresAt > where.expiresAt.lte) return { count: 0 };
        state.challenge = null;
        return { count: 1 };
      },
      findUnique: async () => state.challenge,
      upsert: async ({ create, update }) => {
        state.challenge = { id: 'challenge-id', ...(state.challenge ? update : create) };
        return { id: state.challenge.id };
      },
      updateMany: async ({ where, data }) => {
        if (!state.challenge || state.challenge.attempts >= where.attempts.lt) return { count: 0 };
        state.challenge.attempts += data.attempts.increment;
        return { count: 1 };
      },
    },
    $transaction: async (callback) =>
      callback({
        user: {
          update: async ({ data }) => {
            state.user = { ...state.user, ...data };
          },
        },
        passwordResetChallenge: {
          delete: async () => {
            state.challenge = null;
          },
        },
      }),
  };
  return { database, state };
}

function setup({ user, now = new Date('2026-11-15T10:00:00Z') } = {}) {
  const fake = createFakeDatabase(user);
  const sent = [];
  const clock = { now };
  const service = createPasswordResetService({
    database: fake.database,
    sendOtp: async (payload) => sent.push(payload),
    hashPassword: async (password) => `hashed:${password}`,
    clock: () => clock.now,
    otpFactory: () => '123456',
  });
  return { ...fake, sent, clock, service };
}

const EMAIL = 'user@example.com';

test('requestReset sends an OTP for an existing account', async () => {
  const { service, sent, state } = setup();
  const result = await service.requestReset({ email: ' User@Example.com ' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, EMAIL);
  assert.equal(sent[0].code, '123456');
  assert.equal(state.challenge.otpHash, hashOtp(EMAIL, '123456', SECRET));
  assert.equal(result.resendAfter, 60);
});

test('requestReset gives the same answer for unknown emails and sends nothing', async () => {
  const known = setup();
  const unknown = setup({ user: null });
  const a = await known.service.requestReset({ email: EMAIL });
  const b = await unknown.service.requestReset({ email: 'nobody@example.com' });
  assert.deepEqual(a, b);
  assert.equal(unknown.sent.length, 0);
  assert.equal(unknown.state.challenge, null);
});

test('requestReset skips inactive accounts', async () => {
  const { service, sent } = setup({ user: { id: 'u', isActive: false } });
  await service.requestReset({ email: EMAIL });
  assert.equal(sent.length, 0);
});

test('requestReset respects the resend cooldown', async () => {
  const { service, sent, clock } = setup();
  await service.requestReset({ email: EMAIL });
  clock.now = new Date(clock.now.getTime() + 30 * 1000);
  await service.requestReset({ email: EMAIL });
  assert.equal(sent.length, 1);
  clock.now = new Date(clock.now.getTime() + 40 * 1000);
  await service.requestReset({ email: EMAIL });
  assert.equal(sent.length, 2);
});

test('requestReset rejects a malformed email', async () => {
  const { service } = setup();
  await assert.rejects(service.requestReset({ email: 'not-an-email' }), { code: 'VALIDATION_ERROR' });
});

test('requestReset removes the challenge when delivery fails', async () => {
  const fake = createFakeDatabase();
  const service = createPasswordResetService({
    database: fake.database,
    sendOtp: async () => {
      throw new Error('smtp down');
    },
    otpFactory: () => '123456',
  });
  await assert.rejects(service.requestReset({ email: EMAIL }), /smtp down/);
  assert.equal(fake.state.challenge, null);
});

test('resetPassword updates the password with a correct code and consumes the challenge', async () => {
  const { service, state } = setup();
  await service.requestReset({ email: EMAIL });
  const result = await service.resetPassword({ email: EMAIL, code: '123456', newPassword: 'newsecret' });
  assert.match(result.message, /thành công/);
  assert.equal(state.user.passwordHash, 'hashed:newsecret');
  assert.equal(state.challenge, null);
});

test('resetPassword rejects a wrong code and counts the attempt', async () => {
  const { service, state } = setup();
  await service.requestReset({ email: EMAIL });
  await assert.rejects(
    service.resetPassword({ email: EMAIL, code: '000000', newPassword: 'newsecret' }),
    { code: 'OTP_INVALID' },
  );
  assert.equal(state.challenge.attempts, 1);
  assert.equal(state.user.passwordHash, 'old');
});

test('resetPassword locks out after too many wrong codes', async () => {
  const { service } = setup();
  await service.requestReset({ email: EMAIL });
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(
      service.resetPassword({ email: EMAIL, code: '000000', newPassword: 'newsecret' }),
      { code: 'OTP_INVALID' },
    );
  }
  await assert.rejects(
    service.resetPassword({ email: EMAIL, code: '123456', newPassword: 'newsecret' }),
    { code: 'OTP_ATTEMPTS_EXCEEDED' },
  );
});

test('resetPassword rejects an expired code', async () => {
  const { service, clock, state } = setup();
  await service.requestReset({ email: EMAIL });
  clock.now = new Date(clock.now.getTime() + 11 * 60 * 1000);
  await assert.rejects(
    service.resetPassword({ email: EMAIL, code: '123456', newPassword: 'newsecret' }),
    { code: 'OTP_INVALID_OR_EXPIRED' },
  );
  assert.equal(state.user.passwordHash, 'old');
});

test('resetPassword rejects when no code was requested', async () => {
  const { service } = setup();
  await assert.rejects(
    service.resetPassword({ email: EMAIL, code: '123456', newPassword: 'newsecret' }),
    { code: 'OTP_INVALID_OR_EXPIRED' },
  );
});

test('resetPassword validates the new password before touching the code', async () => {
  const { service, state } = setup();
  await service.requestReset({ email: EMAIL });
  await assert.rejects(
    service.resetPassword({ email: EMAIL, code: '123456', newPassword: '123' }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(state.challenge.attempts, 0);
});
