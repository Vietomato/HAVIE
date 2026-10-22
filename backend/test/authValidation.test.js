import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoginBody, validateRegisterBody } from '../src/utils/authValidation.js';

test('register validation normalizes email and ignores client-supplied privileges', () => {
  const result = validateRegisterBody({
    fullName: '  Nguyen Van A  ',
    email: '  USER@EXAMPLE.COM ',
    phone: ' 0900000000 ',
    password: 'secret1',
    role: 'ADMIN',
    isActive: false,
  });

  assert.deepEqual(result, {
    fullName: 'Nguyen Van A',
    email: 'user@example.com',
    phone: '0900000000',
    password: 'secret1',
  });
});

test('register validation rejects invalid email and bcrypt-incompatible passwords', () => {
  assert.throws(
    () => validateRegisterBody({ fullName: 'A', email: 'invalid', password: 'secret1' }),
    (error) => error.status === 400 && error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () =>
      validateRegisterBody({
        fullName: 'A',
        email: 'a@example.com',
        password: 'a'.repeat(73),
      }),
    (error) => error.details.password !== undefined,
  );
});

test('login validation normalizes email and rejects oversized password input', () => {
  assert.deepEqual(validateLoginBody({ email: 'USER@EXAMPLE.COM', password: 'secret1' }), {
    email: 'user@example.com',
    password: 'secret1',
  });
  assert.throws(
    () => validateLoginBody({ email: 'user@example.com', password: 'a'.repeat(73) }),
    (error) => error.status === 400,
  );
});
