import type { Request, Response, NextFunction } from "express";
declare function listProcessInstancesController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function getProcessInstanceDetailsController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export { listProcessInstancesController, getProcessInstanceDetailsController };
//# sourceMappingURL=process-instance.controller.d.ts.map