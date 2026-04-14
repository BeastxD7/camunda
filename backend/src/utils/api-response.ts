import type { Response } from "express";

type ApiSuccessResponse<T = unknown> = {
	success: true;
	message: string;
	data?: T;
};

type ApiErrorResponse = {
	success: false;
	message: string;
	error: unknown;
};

function apiSuccess<T>(
	res: Response,
	statusCode: number,
	message: string,
	data?: T,
) {
	const body: ApiSuccessResponse<T> = {
		success: true,
		message,
		...(data !== undefined ? { data } : {}),
	};

	return res.status(statusCode).json(body);
}

function apiError(
	res: Response,
	statusCode: number,
	message: string,
	error: unknown,
) {
	const body: ApiErrorResponse = {
		success: false,
		message,
		error,
	};

	return res.status(statusCode).json(body);
}

export { apiSuccess, apiError };