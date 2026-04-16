import type { NextFunction, Request, Response } from "express";
declare function getOptimizeDashboardIdsController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function getOptimizeReportIdsController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function exportOptimizeDashboardDefinitionsController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function enableOptimizeSharingController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function disableOptimizeSharingController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
declare function getOptimizeReportDataController(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export { enableOptimizeSharingController, disableOptimizeSharingController, getOptimizeDashboardIdsController, getOptimizeReportIdsController, exportOptimizeDashboardDefinitionsController, getOptimizeReportDataController, };
//# sourceMappingURL=optimize.controller.d.ts.map