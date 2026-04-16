import { getProcessInstanceDetails, listProcessInstances, } from "../services/process-instance.service.js";
import { apiError, apiSuccess } from "../utils/api-response.js";
async function listProcessInstancesController(req, res, next) {
    try {
        const sizeParam = req.query.size;
        const bpmnProcessIdParam = req.query.bpmnProcessId;
        const size = typeof sizeParam === "string" && Number.isFinite(Number(sizeParam))
            ? Number(sizeParam)
            : 100;
        const bpmnProcessId = typeof bpmnProcessIdParam === "string" && bpmnProcessIdParam.trim().length > 0
            ? bpmnProcessIdParam.trim()
            : undefined;
        const items = await listProcessInstances(size, bpmnProcessId);
        return apiSuccess(res, 200, "Process instances fetched successfully", {
            count: items.length,
            items,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getProcessInstanceDetailsController(req, res, next) {
    try {
        const rawInstanceKey = req.params.instanceKey;
        const instanceKey = typeof rawInstanceKey === "string"
            ? rawInstanceKey
            : Array.isArray(rawInstanceKey)
                ? rawInstanceKey[0]
                : undefined;
        if (!instanceKey) {
            return apiError(res, 400, "Invalid request", {
                instanceKey: "instanceKey is required",
            });
        }
        const details = await getProcessInstanceDetails(instanceKey);
        return apiSuccess(res, 200, "Process instance details fetched successfully", details);
    }
    catch (error) {
        next(error);
    }
}
export { listProcessInstancesController, getProcessInstanceDetailsController };
//# sourceMappingURL=process-instance.controller.js.map