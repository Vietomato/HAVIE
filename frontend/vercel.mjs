// Evaluated by Vercel, not bundled into the browser. Keep browser API calls
// on /api so Secure, SameSite=Lax session and OAuth cookies share the site.
const backend = new URL(process.env.BACKEND_ORIGIN || 'https://missing-backend.invalid');
if (
  backend.protocol !== 'https:' || backend.username || backend.password ||
  backend.pathname !== '/' || backend.search || backend.hash ||
  backend.hostname === 'missing-backend.invalid'
) {
  throw new Error('Set BACKEND_ORIGIN to the Render HTTPS origin, e.g. https://your-api.onrender.com');
}

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/uploads/:path*', destination: `${backend.origin}/uploads/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'CDN-Cache-Control', value: 'no-store' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    },
  ],
};
