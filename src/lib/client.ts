import { PrismaClient } from "@/generated/prisma";
import { assertLocalDatabase } from "../../server/development-guard";

// Also protect direct `next dev` invocations which bypass the supported launcher.
if (process.env.NODE_ENV === "development") assertLocalDatabase(process.env);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient();
export default prisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
