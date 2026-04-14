import { optimizeClient } from "../clients/camunda.client.js";

async function getDashboardIds(collectionId: number) {
	return optimizeClient.getDashboardIds(collectionId);
}

async function getReportIds(collectionId: number) {
	return optimizeClient.getReportIds(collectionId);
}

async function exportDashboardDefinitions(dashboardIds: string[]) {
	return optimizeClient.exportDashboardDefinitions(dashboardIds);
}

export { getDashboardIds, getReportIds, exportDashboardDefinitions };
