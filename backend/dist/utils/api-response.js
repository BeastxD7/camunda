function apiSuccess(res, statusCode, message, data) {
    const body = {
        success: true,
        message,
        ...(data !== undefined ? { data } : {}),
    };
    return res.status(statusCode).json(body);
}
function apiError(res, statusCode, message, error) {
    const body = {
        success: false,
        message,
        error,
    };
    return res.status(statusCode).json(body);
}
export { apiSuccess, apiError };
//# sourceMappingURL=api-response.js.map