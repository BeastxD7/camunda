import { optimizeClient } from "../clients/camunda.client.js";

type OptimizeClientCompat = {
	enableSharing: () => Promise<unknown>;
	disableSharing: () => Promise<unknown>;
	getDashboardIds: (collectionId: string) => Promise<unknown>;
	exportDashboardDefinitions: (dashboardIds: string[]) => Promise<unknown>;
};

const optimizeClientCompat = optimizeClient as unknown as OptimizeClientCompat;

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required to call Optimize API`);
	}
	return value;
}

async function getOptimizeAccessToken(): Promise<string> {
	const oauthUrl = getRequiredEnv("CAMUNDA_OAUTH_URL");
	const clientId = process.env.CAMUNDA_CLIENT_ID ?? process.env.ZEEBE_CLIENT_ID;
	const clientSecret =
		process.env.CAMUNDA_CLIENT_SECRET ?? process.env.ZEEBE_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error(
			"CAMUNDA_CLIENT_ID/CAMUNDA_CLIENT_SECRET (or ZEEBE_CLIENT_ID/ZEEBE_CLIENT_SECRET) are required",
		);
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

	const tokenPayload = (await response.json()) as { access_token?: string };
	if (!tokenPayload.access_token) {
		throw new Error("OAuth token response did not include access_token");
	}

	return tokenPayload.access_token;
}

async function enableSharing() {
	return optimizeClientCompat.enableSharing();
}

async function disableSharing() {
	return optimizeClientCompat.disableSharing();
}

async function getDashboardIds(collectionId: string) {
	return optimizeClientCompat.getDashboardIds(collectionId);
}

async function getReportIds(collectionId: string) {
	const optimizeBaseUrl = getRequiredEnv("CAMUNDA_OPTIMIZE_BASE_URL").replace(/\/$/, "");
	const token = await getOptimizeAccessToken();
	const response = await fetch(
		`${optimizeBaseUrl}/api/public/report?collectionId=${encodeURIComponent(collectionId)}`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Response code ${response.status} (${response.statusText}) - Optimize report lookup failed`);
	}

	return (await response.json()) as unknown;
}

async function exportDashboardDefinitions(dashboardIds: string[]) {
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
		throw new Error(
			`Response code ${response.status} (${response.statusText}) - Optimize dashboard export failed`,
		);
	}

	return (await response.json()) as unknown;
}

async function getReportData(reportId: string) {
	const optimizeBaseUrl = getRequiredEnv("CAMUNDA_OPTIMIZE_BASE_URL").replace(/\/$/, "");
	const token = await getOptimizeAccessToken();

	const response = await fetch(
		`${optimizeBaseUrl}/api/public/export/report/${encodeURIComponent(reportId)}/result/json?limit=1&paginationTimeout=60`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Response code ${response.status} (${response.statusText}) - Optimize report data lookup failed`);
	}

	return (await response.json()) as unknown;
}

export {
	enableSharing,
	disableSharing,
	getDashboardIds,
	getReportIds,
	exportDashboardDefinitions,
	getReportData,
};
