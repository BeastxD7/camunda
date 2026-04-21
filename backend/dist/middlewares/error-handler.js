import { apiError } from "../utils/api-response.js";
function notFoundHandler(req, res, _next) {
    return apiError(res, 404, "Route not found", {
        path: req.originalUrl,
        method: req.method,
    });
}
function errorHandler(err, req, res, _next) {
    const upstreamStatus = getUpstreamStatus(err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const target = getUpstreamTarget(err);
    const isOptimizeTarget = typeof target === "string" && target.includes("optimize.camunda.io");
    const isCamundaTarget = typeof target === "string" &&
        (target.includes("operate.camunda.io") ||
            target.includes("optimize.camunda.io") ||
            target.includes("tasklist.camunda.io") ||
            target.includes("zeebe.camunda.io"));
    const isDemoRoute = req.originalUrl.startsWith("/api/demo");
    if (isPrismaAuthError(err) || isPrismaConnectionError(err)) {
        return apiError(res, 503, "Database is temporarily unavailable", {
            code: "DATABASE_UNAVAILABLE",
            hint: "Ensure local Postgres is running and DATABASE_URL in backend/.env is valid.",
        });
    }
    if (upstreamStatus === 503) {
        return apiError(res, 503, "Camunda Operate is temporarily unavailable", {
            code: "CAMUNDA_OPERATE_UNAVAILABLE",
            upstreamStatus,
            hint: "Retry shortly. If persistent, check Camunda Operate health and credentials.",
        });
    }
    if (isConnectionRefusedError(err) && isCamundaTarget) {
        return apiError(res, 502, "Unable to connect to Camunda Operate", {
            code: "CAMUNDA_OPERATE_UNREACHABLE",
            hint: "Verify CAMUNDA_OPERATE_BASE_URL and OAuth/client credentials in backend/.env",
            target: err.url,
        });
    }
    if (isConnectionRefusedError(err) && isDemoRoute) {
        return apiError(res, 503, "Database is temporarily unavailable", {
            code: "DATABASE_UNAVAILABLE",
            hint: "Ensure local Postgres container is up and reachable on localhost:5432.",
        });
    }
    if ((upstreamStatus === 401 || upstreamStatus === 403) && isOptimizeTarget) {
        return apiError(res, upstreamStatus, message, {
            code: "CAMUNDA_OPTIMIZE_AUTH_ERROR",
            upstreamStatus,
            target,
            hint: "Optimize authentication failed. Verify client has Optimize API permission and CAMUNDA_OPTIMIZE_OAUTH_AUDIENCE=optimize.camunda.io.",
        });
    }
    if (upstreamStatus && upstreamStatus >= 400 && upstreamStatus <= 599) {
        return apiError(res, upstreamStatus, message, {
            code: "CAMUNDA_UPSTREAM_ERROR",
            upstreamStatus,
            target,
        });
    }
    return apiError(res, 500, message, {
        code: "INTERNAL_SERVER_ERROR",
    });
}
function getUpstreamStatus(err) {
    if (!err || typeof err !== "object") {
        return undefined;
    }
    const candidate = err;
    const isHttpStatus = (value) => typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
    if (isHttpStatus(candidate.response?.status)) {
        return candidate.response.status;
    }
    if (isHttpStatus(candidate.response?.statusCode)) {
        return candidate.response.statusCode;
    }
    if (isHttpStatus(candidate.status)) {
        return candidate.status;
    }
    if (isHttpStatus(candidate.statusCode)) {
        return candidate.statusCode;
    }
    const message = typeof candidate.message === "string" ? candidate.message : "";
    const statusFromMessage = message.match(/Response code\s+(\d{3})/i)?.[1];
    if (statusFromMessage) {
        return Number(statusFromMessage);
    }
    const fromSource = getUpstreamStatus(candidate.source);
    if (fromSource !== undefined) {
        return fromSource;
    }
    const fromCause = getUpstreamStatus(candidate.cause);
    if (fromCause !== undefined) {
        return fromCause;
    }
    return undefined;
}
function getUpstreamTarget(err) {
    if (!err || typeof err !== "object") {
        return undefined;
    }
    const candidate = err;
    if (typeof candidate.url === "string") {
        return candidate.url;
    }
    const fromSource = getUpstreamTarget(candidate.source);
    if (fromSource) {
        return fromSource;
    }
    return getUpstreamTarget(candidate.cause);
}
function isConnectionRefusedError(err) {
    if (!err || typeof err !== "object") {
        return false;
    }
    const candidate = err;
    return candidate.code === "ECONNREFUSED";
}
function isPrismaAuthError(err) {
    if (!err || typeof err !== "object") {
        return false;
    }
    const candidate = err;
    const message = typeof candidate.message === "string" ? candidate.message : "";
    return (candidate.code === "P1000" ||
        message.includes("Authentication failed against database server"));
}
function isPrismaConnectionError(err) {
    if (!err || typeof err !== "object") {
        return false;
    }
    const candidate = err;
    const message = typeof candidate.message === "string" ? candidate.message : "";
    return (candidate.code === "P1001" ||
        message.includes("Can't reach database server") ||
        message.includes("database server"));
}
export { notFoundHandler, errorHandler };
//# sourceMappingURL=error-handler.js.map