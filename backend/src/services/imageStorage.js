import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../utils/http.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads',
);

const CLOUDINARY_FOLDER = 'havie/products';
const CLOUDINARY_TIMEOUT_MS = 30_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IMAGE_MIME_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Reads the file's leading bytes because the client controls both the filename
// and the declared MIME type. SVG is excluded on purpose: it can carry scripts.
export function detectImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function parseCloudinaryUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  if (url?.protocol !== 'cloudinary:' || !url.username || !url.password || !url.hostname) {
    throw new HttpError(
      500,
      'SERVER_MISCONFIGURED',
      'CLOUDINARY_URL phải có dạng cloudinary://API_KEY:API_SECRET@CLOUD_NAME.',
    );
  }
  return {
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
    cloudName: url.hostname,
  };
}

export function signCloudinaryParams(params, apiSecret) {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
}

async function uploadToCloudinary(buffer, extension, config, fetchImpl) {
  const params = { folder: CLOUDINARY_FOLDER, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: IMAGE_MIME_TYPES[extension] }));
  form.append('api_key', config.apiKey);
  form.append('folder', params.folder);
  form.append('timestamp', String(params.timestamp));
  form.append('signature', signCloudinaryParams(params, config.apiSecret));

  let response;
  try {
    response = await fetchImpl(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(CLOUDINARY_TIMEOUT_MS) },
    );
  } catch (cause) {
    console.error('Cloudinary upload request failed:', cause);
    throw new HttpError(502, 'IMAGE_UPLOAD_FAILED', 'Không thể tải ảnh lên dịch vụ lưu trữ.');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.secure_url !== 'string') {
    console.error('Cloudinary rejected upload:', response.status, body?.error?.message);
    throw new HttpError(502, 'IMAGE_UPLOAD_FAILED', 'Không thể tải ảnh lên dịch vụ lưu trữ.');
  }
  return body.secure_url;
}

async function saveToLocalDisk(buffer, extension) {
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export async function saveImage(buffer, { fetchImpl = fetch } = {}) {
  const extension = detectImageExtension(buffer);
  if (!extension) {
    throw new HttpError(400, 'INVALID_IMAGE', 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  if (cloudinaryUrl) {
    return uploadToCloudinary(buffer, extension, parseCloudinaryUrl(cloudinaryUrl), fetchImpl);
  }
  return saveToLocalDisk(buffer, extension);
}
