import type { NextFunction, Request, Response } from "express";
import { apiError, apiSuccess } from "../utils/api-response.js";
import {
	disableSharing,
	enableSharing,
	exportDashboardDefinitions,
	getDashboardIds,
	getReportIds,
	getReportData,
} from "../services/optimize.service.js";

function parseCollectionId(input: unknown) {
	if (typeof input !== "string") {
		return undefined;
	}

	const value = input.trim();
	if (!value) {
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
				collectionId: "collectionId query param is required and must be a non-empty string",
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
				collectionId: "collectionId query param is required and must be a non-empty string",
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

async function enableOptimizeSharingController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		await enableSharing();
		return apiSuccess(res, 200, "Optimize sharing enabled successfully");
	} catch (error) {
		next(error);
	}
}

async function disableOptimizeSharingController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		await disableSharing();
		return apiSuccess(res, 200, "Optimize sharing disabled successfully");
	} catch (error) {
		next(error);
	}
}

async function getOptimizeReportDataController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const reportId = parseCollectionId(req.query.reportId);

		if (reportId === undefined) {
			return apiError(res, 400, "Invalid request", {
				reportId: "reportId query param is required and must be a non-empty string",
			});
		}

		const data = await getReportData(reportId);
		return apiSuccess(res, 200, "Optimize report data fetched successfully", data);
	} catch (error) {
		next(error);
	}
}

export {
	enableOptimizeSharingController,
	disableOptimizeSharingController,
	getOptimizeDashboardIdsController,
	getOptimizeReportIdsController,
	exportOptimizeDashboardDefinitionsController,
	getOptimizeReportDataController,
};
