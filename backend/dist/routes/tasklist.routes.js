import { Router } from "express";
import { assignTaskController, completeTaskController, getTaskDetailsController, listTasklistTasksController, } from "../controllers/tasklist.controller.js";
const tasklistRoutes = Router();
/**
 * @openapi
 * /api/tasklist/tasks:
 *   get:
 *     summary: List Tasklist tasks
 *     description: Fetches human tasks from Camunda Tasklist, useful for escalated support cases.
 *     tags:
 *       - Tasklist
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *           enum: [CREATED, COMPLETED, CANCELED, FAILED]
 *         required: false
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *         required: false
 *       - in: query
 *         name: processInstanceKey
 *         schema:
 *           type: string
 *         required: false
 *       - in: query
 *         name: candidateGroup
 *         schema:
 *           type: string
 *         required: false
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         required: false
 *     responses:
 *       200:
 *         description: Tasklist tasks fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 */
tasklistRoutes.get("/tasks", listTasklistTasksController);
/**
 * @openapi
 * /api/tasklist/tasks/{taskId}:
 *   get:
 *     summary: Get Tasklist task details
 *     description: Returns user task details, form schema, and current variables.
 *     tags:
 *       - Tasklist
 *     parameters:
 *       - in: path
 *         name: taskId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Task details fetched successfully.
 */
tasklistRoutes.get("/tasks/:taskId", getTaskDetailsController);
/**
 * @openapi
 * /api/tasklist/tasks/{taskId}/assign:
 *   patch:
 *     summary: Assign task to current operator
 *     description: Assigns a user task using the Orchestration API.
 *     tags:
 *       - Tasklist
 *     parameters:
 *       - in: path
 *         name: taskId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Task assigned successfully.
 */
tasklistRoutes.patch("/tasks/:taskId/assign", assignTaskController);
/**
 * @openapi
 * /api/tasklist/tasks/{taskId}/complete:
 *   patch:
 *     summary: Complete Tasklist task
 *     description: Completes a human task with optional variables payload.
 *     tags:
 *       - Tasklist
 *     parameters:
 *       - in: path
 *         name: taskId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Task completed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 */
tasklistRoutes.patch("/tasks/:taskId/complete", completeTaskController);
export { tasklistRoutes };
//# sourceMappingURL=tasklist.routes.js.map