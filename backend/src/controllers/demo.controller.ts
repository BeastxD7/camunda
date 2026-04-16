import type { NextFunction, Request, Response } from "express";
import { apiError, apiSuccess } from "../utils/api-response.js";
import { getDataSourceMode, setDataSourceMode } from "../services/data-source.service.js";
import { syncAllDemoData } from "../services/demo-data.service.js";

function parseMode(input: unknown) {
	return input === "db" || input === "camunda" ? input : undefined;
}

function parseCollectionId(input: unknown) {
	if (typeof input !== "string") return undefined;
	const value = input.trim();
	return value ? value : undefined;
}

async function getDemoSourceModeController(_req: Request, res: Response, next: NextFunction) {
	try {
		const mode = await getDataSourceMode();
		return apiSuccess(res, 200, "Demo source mode fetched successfully", { mode });
	} catch (error) {
		next(error);
	}
}

async function setDemoSourceModeController(req: Request, res: Response, next: NextFunction) {
	try {
		const mode = parseMode(req.body?.mode);
		if (!mode) {
			return apiError(res, 400, "Invalid request", {
				mode: "mode must be either 'camunda' or 'db'",
			});
		}

		const result = await setDataSourceMode(mode);
		return apiSuccess(res, 200, "Demo source mode updated successfully", result);
	} catch (error) {
		next(error);
	}
}

async function syncDemoDataController(req: Request, res: Response, next: NextFunction) {
	try {
		const collectionId = parseCollectionId(
			req.body?.collectionId || process.env.CAMUNDA_OPTIMIZE_COLLECTION_ID || process.env.VITE_OPTIMIZE_COLLECTION_ID,
		);

		if (!collectionId) {
			return apiError(res, 400, "Invalid request", {
				collectionId: "collectionId is required to sync Optimize data",
			});
		}

		const result = await syncAllDemoData(collectionId);
		return apiSuccess(res, 200, "Demo data synced successfully", {
			collectionId,
			...result,
		});
	} catch (error) {
		next(error);
	}
}

export {
	getDemoSourceModeController,
	setDemoSourceModeController,
	syncDemoDataController,
};