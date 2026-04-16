import { prisma } from "../lib/prisma.js";

type DataSourceMode = "camunda" | "db";

function normalizeMode(input?: string | null): DataSourceMode {
	return input === "db" ? "db" : "camunda";
}

async function getDataSourceMode(): Promise<DataSourceMode> {
	const setting = await prisma.appSetting.findUnique({ where: { key: "data.source.mode" } });
	return normalizeMode(setting?.value || process.env.CAMUNDA_DATA_SOURCE_MODE);
}

async function setDataSourceMode(mode: DataSourceMode) {
	const normalized = normalizeMode(mode);
	await prisma.appSetting.upsert({
		where: { key: "data.source.mode" },
		create: { key: "data.source.mode", value: normalized },
		update: { value: normalized },
	});

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