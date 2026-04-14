import type { NextFunction, Request, Response } from "express";
import { apiError, apiSuccess } from "../utils/api-response.js";
import {
	exportDashboardDefinitions,
	getDashboardIds,
	getReportIds,
} from "../services/optimize.service.js";

function parseCollectionId(input: unknown) {
	if (typeof input !== "string") {
		return undefined;
	}

	const value = Number(input);
	if (!Number.isInteger(value) || value < 0) {
		return undefined;
	}

	return value;
}

async function getOptimizeDashboardIdsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const collectionId = parseCollectionId(req.query.collectionId);

		if (collectionId === undefined) {
			return apiError(res, 400, "Invalid request", {
				collectionId: "collectionId query param must be a non-negative integer",
			});
		}

		const data = await getDashboardIds(collectionId);
		return apiSuccess(res, 200, "Optimize dashboard IDs fetched successfully", data);
	} catch (error) {
		next(error);
	}
}

async function getOptimizeReportIdsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const collectionId = parseCollectionId(req.query.collectionId);

		if (collectionId === undefined) {
			return apiError(res, 400, "Invalid request", {
				collectionId: "collectionId query param must be a non-negative integer",
			});
		}

		const data = await getReportIds(collectionId);
		return apiSuccess(res, 200, "Optimize report IDs fetched successfully", data);
	} catch (error) {
		next(error);
	}
}

async function exportOptimizeDashboardDefinitionsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const dashboardIds = req.body?.dashboardIds;

		if (!Array.isArray(dashboardIds) || !dashboardIds.every((id) => typeof id === "string")) {
			return apiError(res, 400, "Invalid request", {
				dashboardIds: "dashboardIds is required and must be an array of strings",
			});
		}

		const data = await exportDashboardDefinitions(dashboardIds);
		return apiSuccess(
			res,
			200,
			"Optimize dashboard definitions exported successfully",
			data,
		);
	} catch (error) {
		next(error);
	}
}

export {
	getOptimizeDashboardIdsController,
	getOptimizeReportIdsController,
	exportOptimizeDashboardDefinitionsController,
};
