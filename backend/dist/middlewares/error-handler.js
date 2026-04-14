import { apiError } from "../utils/api-response.js";
function notFoundHandler(req, res, _next) {
    return apiError(res, 404, "Route not found", {
        path: req.originalUrl,
        method: req.method,
    });
}
function errorHandler(err, _req, res, _next) {
    const upstreamStatus = getUpstreamStatus(err);
    if (upstreamStatus === 503) {
        return apiError(res, 503, "Camunda Operate is temporarily unavailable", {
            code: "CAMUNDA_OPERATE_UNAVAILABLE",
            upstreamStatus,
            hint: "Retry shortly. If persistent, check Camunda Operate health and credentials.",
        });
    }
    if (isConnectionRefusedError(err)) {
        return apiError(res, 502, "Unable to connect to Camunda Operate", {
            code: "CAMUNDA_OPERATE_UNREACHABLE",
            hint: "Verify CAMUNDA_OPERATE_BASE_URL and OAuth/client credentials in backend/.env",
            target: err.url,
        });
    }
    const message = err instanceof Error ? err.message : "Unexpected server error";
    if (upstreamStatus && upstreamStatus >= 400 && upstreamStatus <= 599) {
        return apiError(res, upstreamStatus, message, {
            code: "CAMUNDA_OPERATE_ERROR",
            upstreamStatus,
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
    if (typeof candidate.status === "number") {
        return candidate.status;
    }
    if (typeof candidate.statusCode === "number") {
        return candidate.statusCode;
    }
    if (typeof candidate.response?.status === "number") {
        return candidate.response.status;
    }
    const message = typeof candidate.message === "string" ? candidate.message : "";
    const statusFromMessage = message.match(/Response code\s+(\d{3})/i)?.[1];
    if (statusFromMessage) {
        return Number(statusFromMessage);
    }
    return undefined;
}
function isConnectionRefusedError(err) {
    if (!err || typeof err !== "object") {
        return false;
    }
    const candidate = err;
    return candidate.code === "ECONNREFUSED";
}
export { notFoundHandler, errorHandler };
//# sourceMappingURL=error-handler.js.map