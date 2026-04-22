import { optimizeClient } from "../clients/camunda.client.js";
import { prisma } from "../lib/prisma.js";
import { getDataSourceMode } from "./data-source.service.js";
const optimizeClientCompat = optimizeClient;
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required to call Optimize API`);
    }
    return value;
}
async function getOptimizeAccessToken() {
    const oauthUrl = getRequiredEnv("CAMUNDA_OAUTH_URL");
    const clientId = process.env.CAMUNDA_CLIENT_ID ?? process.env.ZEEBE_CLIENT_ID;
    const clientSecret = process.env.CAMUNDA_CLIENT_SECRET ?? process.env.ZEEBE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("CAMUNDA_CLIENT_ID/CAMUNDA_CLIENT_SECRET (or ZEEBE_CLIENT_ID/ZEEBE_CLIENT_SECRET) are required");
    }
    const audience = process.env.CAMUNDA_OPTIMIZE_OAUTH_AUDIENCE ?? "optimize.camunda.io";
    const payload = new URLSearchParams({
        grant_type: "client_credentials",
        audience,
        client_id: clientId,
        client_secret: clientSecret,
    });
    const response = await fetch(oauthUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
    });
    if (!response.ok) {
        throw new Error(`Response code ${response.status} (${response.statusText}) - OAuth token request failed`);
    }
    const tokenPayload = (await response.json());
    if (!tokenPayload.access_token) {
        throw new Error("OAuth token response did not include access_token");
    }
    return tokenPayload.access_token;
}
async function enableSharing() {
    if ((await getDataSourceMode()) === "db") {
        return { mode: "db", enabled: true };
    }
    return optimizeClientCompat.enableSharing();
}
async function disableSharing() {
    if ((await getDataSourceMode()) === "db") {
        return { mode: "db", enabled: false };
    }
    return optimizeClientCompat.disableSharing();
}
async function getDashboardIds(collectionId) {
    if ((await getDataSourceMode()) === "db") {
        const rows = await prisma.optimizeDashboardSnapshot.findMany({
            where: { collectionId },
            select: { dashboardId: true },
            orderBy: { updatedAt: "desc" },
        });
        return rows.map((row) => ({ id: row.dashboardId }));
    }
    return optimizeClientCompat.getDashboardIds(collectionId);
}
async function getReportIds(collectionId) {
    if ((await getDataSourceMode()) === "db") {
        const rows = await prisma.optimizeReportSnapshot.findMany({
            where: { collectionId },
            select: { reportId: true },
            orderBy: { updatedAt: "desc" },
        });
        return rows.map((row) => ({ id: row.reportId }));
    }
    const optimizeBaseUrl = getRequiredEnv("CAMUNDA_OPTIMIZE_BASE_URL").replace(/\/$/, "");
    const token = await getOptimizeAccessToken();
    const response = await fetch(`${optimizeBaseUrl}/api/public/report?collectionId=${encodeURIComponent(collectionId)}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`Response code ${response.status} (${response.statusText}) - Optimize report lookup failed`);
    }
    return (await response.json());
}
async function exportDashboardDefinitions(dashboardIds) {
    if ((await getDataSourceMode()) === "db") {
        const dashboardRows = await prisma.optimizeDashboardSnapshot.findMany({
            where: { dashboardId: { in: dashboardIds } },
            select: { dashboardData: true, reportsData: true, collectionId: true },
        });
        const reportRows = await prisma.optimizeReportSnapshot.findMany({
            where: { collectionId: { in: dashboardRows.map((row) => row.collectionId) } },
            select: { reportId: true, name: true, description: true },
        });
        const reportDefinitionsFromDashboards = dashboardRows.flatMap((row) => {
            const reportsData = row.reportsData;
            if (!reportsData || typeof reportsData !== "object" || Array.isArray(reportsData)) {
                return [];
            }
            const candidate = reportsData.reportDefinitions;
            if (!Array.isArray(candidate)) {
                return [];
            }
            return candidate.filter((item) => Boolean(item && typeof item === "object"));
        });
        const reportDefinitionById = new Map();
        for (const definition of reportDefinitionsFromDashboards) {
            const id = typeof definition.id === "string" ? definition.id : "";
            if (!id)
                continue;
            reportDefinitionById.set(id, {
                ...definition,
                exportEntityType: "single_process_report",
            });
        }
        for (const row of reportRows) {
            if (!reportDefinitionById.has(row.reportId)) {
                reportDefinitionById.set(row.reportId, {
                    id: row.reportId,
                    exportEntityType: "single_process_report",
                    name: row.name,
                    description: row.description,
                });
            }
        }
        return [
            ...dashboardRows.map((row) => row.dashboardData),
            ...Array.from(reportDefinitionById.values()),
        ];
    }
    const optimizeBaseUrl = getRequiredEnv("CAMUNDA_OPTIMIZE_BASE_URL").replace(/\/$/, "");
    const token = await getOptimizeAccessToken();
    const response = await fetch(`${optimizeBaseUrl}/api/public/export/dashboard/definition/json`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(dashboardIds),
    });
    if (!response.ok) {
        throw new Error(`Response code ${response.status} (${response.statusText}) - Optimize dashboard export failed`);
    }
    return (await response.json());
}
async function getReportData(reportId) {
    if ((await getDataSourceMode()) === "db") {
        const row = await prisma.optimizeReportSnapshot.findUnique({ where: { sourceKey: reportId } });
        if (!row) {
            throw new Error(`Optimize report ${reportId} not found in demo database`);
        }
        return row.reportData;
    }
    const optimizeBaseUrl = getRequiredEnv("CAMUNDA_OPTIMIZE_BASE_URL").replace(/\/$/, "");
    const token = await getOptimizeAccessToken();
    const response = await fetch(`${optimizeBaseUrl}/api/public/export/report/${encodeURIComponent(reportId)}/result/json?limit=1&paginationTimeout=60`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`Response code ${response.status} (${response.statusText}) - Optimize report data lookup failed`);
    }
    return (await response.json());
}
export { enableSharing, disableSharing, getDashboardIds, getReportIds, exportDashboardDefinitions, getReportData, };
//# sourceMappingURL=optimize.service.js.map