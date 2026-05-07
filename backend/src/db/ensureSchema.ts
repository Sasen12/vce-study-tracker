import { prisma } from "./prismaClient.js";

export const ensureDatabaseSchema = async () => {
  await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_name TEXT`;
};
