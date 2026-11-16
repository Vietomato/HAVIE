import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const docsDir = path.dirname(fileURLToPath(import.meta.url));
// swagger-jsdoc expects forward slashes in glob patterns, also on Windows.
const openapiGlob = path.join(docsDir, 'openapi', '*.yaml').replaceAll('\\', '/');

// Order of the groups on the docs page (tags are declared in the YAML files).
const TAG_ORDER = ['Health', 'Auth', 'Social login', 'Catalog', 'Cart', 'Vouchers', 'Orders', 'Reviews', 'Payments', 'Chat advisor', 'Admin'];

export function buildOpenApiSpec() {
  const spec = swaggerJsdoc({
    failOnErrors: true,
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'HAVIE API',
        version: '1.0.0',
        description: [
          'API của cửa hàng cầu lông HAVIE.',
          '',
          '**Đăng nhập:** gọi `POST /api/auth/login`, server trả cookie `havie_session` (HttpOnly).',
          'Trình duyệt tự gửi cookie này ở các request sau, nên không cần bấm Authorize.',
          '',
          '**CSRF:** mọi request POST/PATCH/DELETE cần header `X-Havie-Request: 1`',
          'và Origin hợp lệ. Trang docs này tự thêm header đó.',
          '',
          '**Định dạng response:** thành công trả `{ data, message?, meta? }`,',
          'lỗi trả `{ error: { code, message, details? } }`.',
        ].join('\n'),
      },
      servers: [{ url: '/' }],
    },
    apis: [openapiGlob],
  });
  const rank = (tag) => (TAG_ORDER.includes(tag.name) ? TAG_ORDER.indexOf(tag.name) : TAG_ORDER.length);
  spec.tags = [...(spec.tags ?? [])].sort((a, b) => rank(a) - rank(b));
  return spec;
}

export function mountSwagger(app) {
  const spec = buildOpenApiSpec();
  app.get('/api/docs.json', (req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: 'HAVIE API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      requestInterceptor: (request) => {
        request.headers['X-Havie-Request'] = '1';
        return request;
      },
    },
  }));
}
