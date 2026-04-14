import type { Response } from "express";
declare function apiSuccess<T>(res: Response, statusCode: number, message: string, data?: T): Response<any, Record<string, any>>;
declare function apiError(res: Response, statusCode: number, message: string, error: unknown): Response<any, Record<string, any>>;
export { apiSuccess, apiError };
//# sourceMappingURL=api-response.d.ts.map