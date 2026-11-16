// Writes the OpenAPI spec to docs/api/openapi.json for the public API docs page.
// Run from backend/: npm run docs:export
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiSpec } from '../src/docs/swagger.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outFile = path.join(repoRoot, 'docs', 'api', 'openapi.json');

const spec = buildOpenApiSpec();
// The public page is static, so point readers at the local dev server instead of '/'.
spec.servers = [{ url: 'http://localhost:3000', description: 'Backend chạy trên máy (npm run dev)' }];

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const operations = Object.values(spec.paths).reduce(
  (count, item) => count + Object.keys(item).filter((key) => key !== 'parameters').length,
  0,
);
console.log(`Wrote ${path.relative(repoRoot, outFile)} (${operations} endpoints)`);
