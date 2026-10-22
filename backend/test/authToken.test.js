import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createAccessToken, getJwtConfiguration } from '../src/middlewares/authMiddleware.js';

test('access token uses the configured secret and reports expiry in seconds', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousExpiry = process.env.JWT_EXPIRES_IN;
  process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';
  process.env.JWT_EXPIRES_IN = '2h';

  try {
    const token = await createAccessToken({ id: 'user-id' });
    const payload = jwt.verify(token.accessToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    assert.equal(payload.sub, 'user-id');
    assert.equal(token.expiresIn, 7200);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = previousExpiry;
  }
});

test('JWT configuration rejects short secrets and invalid expiry values', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousExpiry = process.env.JWT_EXPIRES_IN;

  try {
    process.env.JWT_SECRET = 'too-short';
    process.env.JWT_EXPIRES_IN = '1h';
    assert.throws(() => getJwtConfiguration(), (error) => error.code === 'SERVER_MISCONFIGURED');

    process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';
    process.env.JWT_EXPIRES_IN = 'never';
    assert.throws(() => getJwtConfiguration(), (error) => error.code === 'SERVER_MISCONFIGURED');
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = previousExpiry;
  }
});
