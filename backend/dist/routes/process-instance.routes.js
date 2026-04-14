import { Router } from "express";
import { getProcessInstanceDetailsController, listProcessInstancesController, } from "../controllers/process-instance.controller.js";
const processInstanceRoutes = Router();
/**
 * @openapi
 * /api/process-instances:
 *   get:
 *     summary: List process instances
 *     description: Fetches process instances from Camunda Operate.
 *     tags:
 *       - Process Instances
 *     parameters:
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 100
 *         required: false
 *         description: Page size used per Operate fetch cycle.
 *     responses:
 *       200:
 *         description: Process instances fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
processInstanceRoutes.get("/", listProcessInstancesController);
/**
 * @openapi
 * /api/process-instances/{instanceKey}:
 *   get:
 *     summary: Get process instance details
 *     description: Fetches a process instance with flow nodes and variables. Variable values are returned as parsed JSON where possible instead of raw JSON strings.
 *     tags:
 *       - Process Instances
 *     parameters:
 *       - in: path
 *         name: instanceKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Camunda process instance key.
 *     responses:
 *       200:
 *         description: Process instance details fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       400:
 *         description: Invalid request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
processInstanceRoutes.get("/:instanceKey", getProcessInstanceDetailsController);
export { processInstanceRoutes };
//# sourceMappingURL=process-instance.routes.js.map