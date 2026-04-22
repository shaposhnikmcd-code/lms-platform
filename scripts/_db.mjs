// @prisma/client auto-loads .env on import (before our code runs), so
// process.env.DATABASE_URL would already be set to the prod URL. We must
// `override: true` to force .env.local's dev-branch URL to win.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

config({ path: resolve(root, '.env.local'), override: true });

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

export default prisma;
