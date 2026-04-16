import { Router } from "express";
import {
	disableOptimizeSharingController,
	enableOptimizeSharingController,
	exportOptimizeDashboardDefinitionsController,
	getOptimizeDashboardIdsController,
	getOptimizeReportIdsController,
	getOptimizeReportDataController,
} from "../controllers/optimize.controller.js";

const optimizeRoutes = Router();

/**
 * @openapi
 * /api/optimize/dashboard-ids:
 *   get:
 *     summary: Get Optimize dashboard IDs by collection
 *     tags:
 *       - Optimize
 *     parameters:
 *       - in: query
 *         name: collectionId
 *         schema:
 *           type: string
 *         required: true
 *         description: Optimize collection ID.
 *     responses:
 *       200:
 *         description: Dashboard IDs fetched.
 *       400:
 *         description: Invalid request.
 */
optimizeRoutes.get("/dashboard-ids", getOptimizeDashboardIdsController);

/**
 * @openapi
 * /api/optimize/report-ids:
 *   get:
 *     summary: Get Optimize report IDs by collection
 *     tags:
 *       - Optimize
 *     parameters:
 *       - in: query
 *         name: collectionId
 *         schema:
 *           type: string
 *         required: true
 *         description: Optimize collection ID.
 *     responses:
 *       200:
 *         description: Report IDs fetched.
 *       400:
 *         description: Invalid request.
 */
optimizeRoutes.get("/report-ids", getOptimizeReportIdsController);

/**
 * @openapi
 * /api/optimize/dashboard-definitions/export:
 *   post:
 *     summary: Export Optimize dashboard definitions
 *     tags:
 *       - Optimize
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dashboardIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Dashboard definitions exported.
 *       400:
 *         description: Invalid request.
 */
optimizeRoutes.post(
	"/dashboard-definitions/export",
	exportOptimizeDashboardDefinitionsController,
);

/**
 * @openapi
 * /api/optimize/report-data:
 *   get:
 *     summary: Get Optimize report result data
 *     tags:
 *       - Optimize
 *     parameters:
 *       - in: query
 *         name: reportId
 *         schema:
 *           type: string
 *         required: true
 *         description: Optimize report ID.
 *     responses:
 *       200:
 *         description: Report data fetched.
 *       400:
 *         description: Invalid request.
 */
optimizeRoutes.get("/report-data", getOptimizeReportDataController);

/**
 * @openapi
 * /api/optimize/sharing/enable:
 *   post:
 *     summary: Enable Optimize sharing globally
 *     tags:
 *       - Optimize
 *     responses:
 *       200:
 *         description: Sharing enabled.
 */
optimizeRoutes.post("/sharing/enable", enableOptimizeSharingController);

/**
 * @openapi
 * /api/optimize/sharing/disable:
 *   post:
 *     summary: Disable Optimize sharing globally
 *     tags:
 *       - Optimize
 *     responses:
 *       200:
 *         description: Sharing disabled.
 */
optimizeRoutes.post("/sharing/disable", disableOptimizeSharingController);

export { optimizeRoutes };
