import type { NextFunction, Request, Response } from "express";
import { apiError, apiSuccess } from "../utils/api-response.js";
import {
	getBankSchemaSummary,
	getBankTableData,
	getBankTables,
	getBankCustomers,
	getCardsByCustomerEmail,
	getTransactionsByCustomerEmail,
	getScreeningMembers,
	getScreeningActivityLogs,
} from "../services/bank.service.js";

function parseIntegerQuery(
	input: unknown,
	fallback: number,
	fieldName: string,
): { value: number; error: string | null } {
	if (typeof input !== "string") {
		return { value: fallback, error: null };
	}

	const parsed = Number.parseInt(input, 10);
	if (!Number.isFinite(parsed)) {
		return { value: fallback, error: `Query parameter '${fieldName}' must be an integer` };
	}

	return { value: parsed, error: null };
}

function parsePagination(req: Request):
	| { ok: true; limit: number; offset: number }
	| { ok: false; error: string } {
	const limitParsed = parseIntegerQuery(req.query.limit, 50, "limit");
	if (limitParsed.error) {
		return { ok: false, error: limitParsed.error };
	}

	const offsetParsed = parseIntegerQuery(req.query.offset, 0, "offset");
	if (offsetParsed.error) {
		return { ok: false, error: offsetParsed.error };
	}

	if (limitParsed.value < 1 || limitParsed.value > 200) {
		return { ok: false, error: "Query parameter 'limit' must be between 1 and 200" };
	}

	if (offsetParsed.value < 0) {
		return { ok: false, error: "Query parameter 'offset' must be greater than or equal to 0" };
	}

	return { ok: true, limit: limitParsed.value, offset: offsetParsed.value };
}

async function getBankSchemaSummaryController(
	_req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const summary = await getBankSchemaSummary();
		return apiSuccess(res, 200, "Bank schema summary fetched successfully", summary);
	} catch (error) {
		next(error);
	}
}

async function getBankTablesController(
	_req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const tables = await getBankTables();
		return apiSuccess(res, 200, "Bank tables fetched successfully", tables);
	} catch (error) {
		next(error);
	}
}

async function getBankTableDataController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const schema = typeof req.query.schema === "string" ? req.query.schema : "public";
		const table = typeof req.query.table === "string" ? req.query.table : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		if (!table.trim()) {
			return apiError(res, 400, "Query parameter 'table' is required", {
				code: "BAD_REQUEST",
			});
		}

		const tableData = await getBankTableData({
			tableSchema: schema,
			tableName: table,
			limit: pagination.limit,
			offset: pagination.offset,
		});

		return apiSuccess(res, 200, "Bank table data fetched successfully", tableData);
	} catch (error) {
		next(error);
	}
}

async function getBankCustomersController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const search = typeof req.query.search === "string" ? req.query.search : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		const customers = await getBankCustomers({
			search,
			limit: pagination.limit,
			offset: pagination.offset,
		});
		return apiSuccess(res, 200, "Bank customers fetched successfully", customers);
	} catch (error) {
		next(error);
	}
}

async function getBankCustomerCardsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const email = typeof req.params.email === "string" ? req.params.email : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		if (!email.trim()) {
			return apiError(res, 400, "Path parameter 'email' is required", {
				code: "BAD_REQUEST",
			});
		}

		const cards = await getCardsByCustomerEmail({
			email,
			limit: pagination.limit,
			offset: pagination.offset,
		});
		return apiSuccess(res, 200, "Bank customer cards fetched successfully", cards);
	} catch (error) {
		next(error);
	}
}

async function getBankCustomerTransactionsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const email = typeof req.params.email === "string" ? req.params.email : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		if (!email.trim()) {
			return apiError(res, 400, "Path parameter 'email' is required", {
				code: "BAD_REQUEST",
			});
		}

		const transactions = await getTransactionsByCustomerEmail({
			email,
			limit: pagination.limit,
			offset: pagination.offset,
		});
		return apiSuccess(res, 200, "Bank customer transactions fetched successfully", transactions);
	} catch (error) {
		next(error);
	}
}

async function getScreeningMembersController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const search = typeof req.query.search === "string" ? req.query.search : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		const members = await getScreeningMembers({
			search,
			limit: pagination.limit,
			offset: pagination.offset,
		});
		return apiSuccess(res, 200, "Screening members fetched successfully", members);
	} catch (error) {
		next(error);
	}
}

async function getScreeningActivityLogsController(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const memberId = typeof req.params.memberId === "string" ? req.params.memberId : "";
		const pagination = parsePagination(req);
		if (!pagination.ok) {
			return apiError(res, 400, pagination.error, {
				code: "BAD_REQUEST",
			});
		}

		if (!memberId.trim()) {
			return apiError(res, 400, "Path parameter 'memberId' is required", {
				code: "BAD_REQUEST",
			});
		}

		const logs = await getScreeningActivityLogs({
			memberId,
			limit: pagination.limit,
			offset: pagination.offset,
		});
		return apiSuccess(res, 200, "Screening activity logs fetched successfully", logs);
	} catch (error) {
		next(error);
	}
}

export {
	getBankSchemaSummaryController,
	getBankTablesController,
	getBankTableDataController,
	getBankCustomersController,
	getBankCustomerCardsController,
	getBankCustomerTransactionsController,
	getScreeningMembersController,
	getScreeningActivityLogsController,
};
