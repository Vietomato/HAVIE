import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import {
  UPLOADS_DIR,
  detectImageExtension,
  parseCloudinaryUrl,
  saveImage,
  signCloudinaryParams,
} from '../src/services/imageStorage.js';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
]);

function withCloudinaryUrl(value, run) {
  const previous = process.env.CLOUDINARY_URL;
  if (value === undefined) delete process.env.CLOUDINARY_URL;
  else process.env.CLOUDINARY_URL = value;
  return Promise.resolve(run()).finally(() => {
    if (previous === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = previous;
  });
}

test('image type comes from the file bytes', () => {
  assert.equal(detectImageExtension(JPG), 'jpg');
  assert.equal(detectImageExtension(PNG), 'png');
  assert.equal(detectImageExtension(WEBP), 'webp');
});

test('SVG, HTML and truncated files are not treated as images', () => {
  assert.equal(detectImageExtension(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(detectImageExtension(Buffer.from('<!doctype html><script></script>')), null);
  assert.equal(detectImageExtension(Buffer.from('RIFF')), null);
  assert.equal(detectImageExtension(Buffer.alloc(0)), null);
});

test('non-image content is rejected before anything is stored', async () => {
  await assert.rejects(
    saveImage(Buffer.from('<svg></svg>'), {
      fetchImpl: () => assert.fail('must not reach the storage service'),
    }),
    (error) => error.status === 400 && error.code === 'INVALID_IMAGE',
  );
});

test('images are stored locally under a generated name without Cloudinary', async () => {
  await withCloudinaryUrl(undefined, async () => {
    const url = await saveImage(PNG);
    assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    await rm(path.join(UPLOADS_DIR, path.basename(url)));
  });
});

test('Cloudinary configuration is parsed and validated', () => {
  assert.deepEqual(parseCloudinaryUrl('cloudinary://key:se%2Fcret@demo'), {
    apiKey: 'key',
    apiSecret: 'se/cret',
    cloudName: 'demo',
  });
  assert.throws(
    () => parseCloudinaryUrl('https://example.com'),
    (error) => error.code === 'SERVER_MISCONFIGURED',
  );
});

test('Cloudinary signature hashes sorted params followed by the secret', () => {
  assert.equal(
    signCloudinaryParams({ timestamp: 123, folder: 'a/b' }, 'secret'),
    createHash('sha1').update('folder=a/b&timestamp=123secret').digest('hex'),
  );
});

test('Cloudinary upload sends a signed request and returns the secure URL', async () => {
  await withCloudinaryUrl('cloudinary://key:secret@demo', async () => {
    let request;
    const url = await saveImage(JPG, {
      fetchImpl: async (target, options) => {
        request = { target, form: options.body };
        return Response.json({ secure_url: 'https://cdn.example/a.jpg' });
      },
    });

    assert.equal(url, 'https://cdn.example/a.jpg');
    assert.equal(request.target, 'https://api.cloudinary.com/v1_1/demo/image/upload');
    assert.equal(request.form.get('api_key'), 'key');
    assert.equal(request.form.get('folder'), 'havie/products');
    assert.equal(
      request.form.get('signature'),
      signCloudinaryParams(
        { folder: 'havie/products', timestamp: request.form.get('timestamp') },
        'secret',
      ),
    );
    assert.equal(request.form.has('api_secret'), false);
  });
});

test('Cloudinary failures surface as a controlled upload error', async () => {
  await withCloudinaryUrl('cloudinary://key:secret@demo', async () => {
    const isUploadFailure = (error) => error.status === 502 && error.code === 'IMAGE_UPLOAD_FAILED';

    await assert.rejects(
      saveImage(JPG, {
        fetchImpl: async () =>
          Response.json({ error: { message: 'Invalid signature' } }, { status: 401 }),
      }),
      isUploadFailure,
    );
    await assert.rejects(
      saveImage(JPG, {
        fetchImpl: async () => {
          throw new TypeError('fetch failed');
        },
      }),
      isUploadFailure,
    );
  });
});
