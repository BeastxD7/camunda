import type { Request, Response, NextFunction } from "express";
declare function notFoundHandler(req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>>;
declare function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>>;
export { notFoundHandler, errorHandler };
//# sourceMappingURL=error-handler.d.ts.map