import type { NextFunction, Request, Response } from "express";
declare function listTasklistTasksController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function getTaskDetailsController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function assignTaskController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function completeTaskController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export { listTasklistTasksController, getTaskDetailsController, assignTaskController, completeTaskController, };
//# sourceMappingURL=tasklist.controller.d.ts.map