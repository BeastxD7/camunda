import "dotenv/config";
import { Camunda8 } from "@camunda8/sdk";

function toBoolean(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === "true") return true;
	if (normalized === "false") return false;
	return undefined;
}

function toAuthStrategy(
	value: string | undefined,
): "BASIC" | "OAUTH" | "BEARER" | "COOKIE" | "NONE" | undefined {
	if (!value) return undefined;
	const normalized = value.trim().toUpperCase();
	if (
		normalized === "BASIC" ||
		normalized === "OAUTH" ||
		normalized === "BEARER" ||
		normalized === "COOKIE" ||
		normalized === "NONE"
	) {
		return normalized;
	}
	return undefined;
}

function setIfDefined(
	target: Record<string, unknown>,
	key: string,
	value: unknown,
) {
	if (value !== undefined) {
		target[key] = value;
	}
}

const camundaConfig: Record<string, unknown> = {};

setIfDefined(camundaConfig, "CAMUNDA_OAUTH_URL", process.env.CAMUNDA_OAUTH_URL);
setIfDefined(
	camundaConfig,
	"ZEEBE_CLIENT_ID",
	process.env.ZEEBE_CLIENT_ID ?? process.env.CAMUNDA_CLIENT_ID,
);
setIfDefined(
	camundaConfig,
	"ZEEBE_CLIENT_SECRET",
	process.env.ZEEBE_CLIENT_SECRET ?? process.env.CAMUNDA_CLIENT_SECRET,
);
setIfDefined(camundaConfig, "CAMUNDA_TOKEN_SCOPE", process.env.CAMUNDA_TOKEN_SCOPE);
setIfDefined(
	camundaConfig,
	"CAMUNDA_OPERATE_BASE_URL",
	process.env.CAMUNDA_OPERATE_BASE_URL,
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_TASKLIST_BASE_URL",
	process.env.CAMUNDA_TASKLIST_BASE_URL,
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_OPTIMIZE_BASE_URL",
	process.env.CAMUNDA_OPTIMIZE_BASE_URL,
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_ZEEBE_OAUTH_AUDIENCE",
	process.env.CAMUNDA_ZEEBE_OAUTH_AUDIENCE ??
		process.env.CAMUNDA_TOKEN_AUDIENCE ??
		process.env.ZEEBE_TOKEN_AUDIENCE,
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_OPERATE_OAUTH_AUDIENCE",
	process.env.CAMUNDA_OPERATE_OAUTH_AUDIENCE ?? "operate.camunda.io",
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_TASKLIST_OAUTH_AUDIENCE",
	process.env.CAMUNDA_TASKLIST_OAUTH_AUDIENCE ?? "tasklist.camunda.io",
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_OPTIMIZE_OAUTH_AUDIENCE",
	process.env.CAMUNDA_OPTIMIZE_OAUTH_AUDIENCE ?? "optimize.camunda.io",
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_AUTH_STRATEGY",
	toAuthStrategy(process.env.CAMUNDA_AUTH_STRATEGY),
);
setIfDefined(
	camundaConfig,
	"CAMUNDA_TOKEN_DISK_CACHE_DISABLE",
	toBoolean(process.env.CAMUNDA_TOKEN_DISK_CACHE_DISABLE) ?? true,
);

const camundaClient = new Camunda8(camundaConfig as any);
const operateClient = camundaClient.getOperateApiClient();
const optimizeClient = camundaClient.getOptimizeApiClient();
const tasklistClient = camundaClient.getTasklistApiClient();
const orchestrationClient: any = camundaClient.getOrchestrationClusterApiClientLoose();

export { camundaClient, operateClient, optimizeClient, orchestrationClient, tasklistClient };