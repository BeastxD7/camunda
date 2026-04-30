import { prisma } from "../lib/prisma.js";

type DataSourceMode = "camunda" | "db";

function normalizeMode(input?: string | null): DataSourceMode {
	return input === "db" ? "db" : "camunda";
}

async function getDataSourceMode(): Promise<DataSourceMode> {
	try {
		const setting = await prisma.appSetting.findUnique({ where: { key: "data.source.mode" } });
		return normalizeMode(setting?.value || process.env.CAMUNDA_DATA_SOURCE_MODE);
	} catch (err) {
		// If the database is unreachable or access is denied, log and fall back to env var.
		console.error('getDataSourceMode: failed to read AppSetting, falling back to env', err);
		return normalizeMode(process.env.CAMUNDA_DATA_SOURCE_MODE);
	}
}

async function setDataSourceMode(mode: DataSourceMode) {
	const normalized = normalizeMode(mode);
	try {
		await prisma.appSetting.upsert({
			where: { key: "data.source.mode" },
			create: { key: "data.source.mode", value: normalized },
			update: { value: normalized },
		});
	} catch (err) {
		// Non-fatal: if DB is unavailable or write is denied, log and continue.
		console.error('setDataSourceMode: failed to persist AppSetting', err);
	}

	return { mode: normalized };
}

async function runWithDataSourceMode<T>(mode: DataSourceMode, callback: () => Promise<T>): Promise<T> {
	const previousMode = await getDataSourceMode();
	await setDataSourceMode(mode);

	try {
		return await callback();
	} finally {
		await setDataSourceMode(previousMode);
	}
}

export { getDataSourceMode, setDataSourceMode, runWithDataSourceMode };
export type { DataSourceMode };