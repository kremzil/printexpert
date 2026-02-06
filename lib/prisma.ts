import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const prismaPool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

globalForPrisma.prismaPool = prismaPool;

export function getPrisma() {
  const cachedPrisma = globalForPrisma.prisma;
  const hasCategoryDelegate = Boolean(cachedPrisma?.category);

  if (cachedPrisma && hasCategoryDelegate) {
    return cachedPrisma;
  }

  const client = new PrismaClient({
    adapter: new PrismaPg(prismaPool),
  });

  globalForPrisma.prisma = client;

  return client;
}

export const prisma = getPrisma();
