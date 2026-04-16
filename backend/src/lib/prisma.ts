import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is required for Prisma client initialization");
}

const adapter = new PrismaPg({ connectionString });

const PrismaClientCtor = PrismaClient as unknown as new (...args: any[]) => PrismaClient;
const prisma = globalForPrisma.prisma ?? new PrismaClientCtor({ adapter });

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export { prisma };