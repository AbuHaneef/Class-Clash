import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const defaultDbFile = path.resolve(process.cwd(), "db", "custom.db");
const envPath = process.env.DATABASE_URL?.startsWith("file:")
  ? path.resolve(process.cwd(), "prisma", process.env.DATABASE_URL.slice(5))
  : null;

if (!envPath || !fs.existsSync(envPath)) {
  process.env.DATABASE_URL = `file:${defaultDbFile.replace(/\\/g, "/")}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;