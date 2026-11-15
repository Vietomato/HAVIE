import { PrismaClient } from '@prisma/client';

const options = {};
if (process.env.DATABASE_URL) {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!databaseUrl.searchParams.has('connection_limit')) databaseUrl.searchParams.set('connection_limit', process.env.PRISMA_POOL_LIMIT || '10');
  if (!databaseUrl.searchParams.has('pool_timeout')) databaseUrl.searchParams.set('pool_timeout', '10');
  options.datasources = { db: { url: databaseUrl.href } };
}
const prisma = new PrismaClient({
  ...options,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;

