declare function getDashboardIds(collectionId: number): Promise<import("@camunda8/sdk/dist/optimize/lib/APIObjects.js").DashboardCollection>;
declare function getReportIds(collectionId: number): Promise<import("@camunda8/sdk/dist/optimize/lib/APIObjects.js").ReportCollection>;
declare function exportDashboardDefinitions(dashboardIds: string[]): Promise<unknown[]>;
export { getDashboardIds, getReportIds, exportDashboardDefinitions };
//# sourceMappingURL=optimize.service.d.ts.map