import { Pool } from "pg";

const connectionString = process.env.BANK_DATABASE_URL;

if (!connectionString) {
	throw new Error("BANK_DATABASE_URL is required for bank database client initialization");
}

const sslRequired = /sslmode=require/i.test(connectionString);

const bankDbPool = new Pool({
	connectionString,
	ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
	max: 5,
	idleTimeoutMillis: 10_000,
	connectionTimeoutMillis: 10_000,
});

export { bankDbPool };
