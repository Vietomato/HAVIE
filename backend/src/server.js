import 'dotenv/config';
import app from './app.js';
import { warmKnowledgeSearch } from './services/knowledgeBase.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 3000;

const server = app.listen({ port: Number(PORT), backlog: 4096 }, () => {
  console.log(`HAVIE Backend server is running at http://localhost:${PORT}`);
  console.log(`API base path: http://localhost:${PORT}/api`);
  void warmKnowledgeSearch().then((mode) => console.log(`Knowledge retrieval ready: ${mode}`));
});
server.requestTimeout = 360000;
server.headersTimeout = 65000;
const cleanup = setInterval(() => {
  const where = { expiresAt: { lte: new Date() } };
  void Promise.all([prisma.authRecord.deleteMany({ where }), prisma.rateCounter.deleteMany({ where }), prisma.runtimeLease.deleteMany({ where })])
    .catch(() => console.warn('Expired authentication records could not be cleaned.'));
}, 300000);
cleanup.unref();

function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
