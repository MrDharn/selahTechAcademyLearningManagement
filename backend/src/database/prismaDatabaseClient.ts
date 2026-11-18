import { PrismaClient } from '@prisma/client';

export const prismaDatabaseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
