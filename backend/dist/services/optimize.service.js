import { optimizeClient } from "../clients/camunda.client.js";
async function getDashboardIds(collectionId) {
    return optimizeClient.getDashboardIds(collectionId);
}
async function getReportIds(collectionId) {
    return optimizeClient.getReportIds(collectionId);
}
async function exportDashboardDefinitions(dashboardIds) {
    return optimizeClient.exportDashboardDefinitions(dashboardIds);
}
export { getDashboardIds, getReportIds, exportDashboardDefinitions };
//# sourceMappingURL=optimize.service.js.map