import { Router } from "express";
import {
	getBankCustomerCardsController,
	getBankCustomerTransactionsController,
	getBankCustomersController,
	getBankSchemaSummaryController,
	getBankTableDataController,
	getBankTablesController,
	getScreeningActivityLogsController,
	getScreeningMembersController,
} from "../controllers/bank.controller.js";

const bankRoutes = Router();

/**
 * @openapi
 * /api/bank/schema-summary:
 *   get:
 *     summary: Get read-only bank database schema summary
 *     tags:
 *       - Bank
 *     responses:
 *       200:
 *         description: Bank schema summary fetched.
 */
bankRoutes.get("/schema-summary", getBankSchemaSummaryController);

/**
 * @openapi
 * /api/bank/tables:
 *   get:
 *     summary: List read-only bank database tables with row estimates
 *     tags:
 *       - Bank
 *     responses:
 *       200:
 *         description: Bank tables fetched.
 */
bankRoutes.get("/tables", getBankTablesController);

/**
 * @openapi
 * /api/bank/table-data:
 *   get:
 *     summary: Get paginated rows from a bank table (read-only)
 *     tags:
 *       - Bank
 *     parameters:
 *       - in: query
 *         name: schema
 *         schema:
 *           type: string
 *         required: false
 *         description: Table schema, defaults to public.
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *         required: true
 *         description: Table name.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page size, default 50, max 200.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         required: false
 *         description: Row offset, default 0.
 *     responses:
 *       200:
 *         description: Bank table data fetched.
 */
bankRoutes.get("/table-data", getBankTableDataController);

/**
 * @openapi
 * /api/bank/customers:
 *   get:
 *     summary: List customers from bank database
 *     tags:
 *       - Bank
 */
bankRoutes.get("/customers", getBankCustomersController);

/**
 * @openapi
 * /api/bank/customers/{email}/cards:
 *   get:
 *     summary: List cards for a customer email
 *     tags:
 *       - Bank
 */
bankRoutes.get("/customers/:email/cards", getBankCustomerCardsController);

/**
 * @openapi
 * /api/bank/customers/{email}/transactions:
 *   get:
 *     summary: List transactions for a customer email
 *     tags:
 *       - Bank
 */
bankRoutes.get("/customers/:email/transactions", getBankCustomerTransactionsController);

/**
 * @openapi
 * /api/bank/screening-members:
 *   get:
 *     summary: List screening members
 *     tags:
 *       - Bank
 */
bankRoutes.get("/screening-members", getScreeningMembersController);

/**
 * @openapi
 * /api/bank/screening-members/{memberId}/activity:
 *   get:
 *     summary: List activity logs for a screening member
 *     tags:
 *       - Bank
 */
bankRoutes.get("/screening-members/:memberId/activity", getScreeningActivityLogsController);

export { bankRoutes };
