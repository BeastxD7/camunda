import { apiError, apiSuccess } from "../utils/api-response.js";
import { assignTask, completeTask, getTasklistTaskDetails, listTasklistTasks, } from "../services/tasklist.service.js";
function toNonEmptyString(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
function toTaskVariableValue(value) {
    return value;
}
function coerceVariables(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {};
    }
    const out = {};
    for (const [key, value] of Object.entries(input)) {
        out[key] = toTaskVariableValue(value);
    }
    return out;
}
async function listTasklistTasksController(req, res, next) {
    try {
        const state = toNonEmptyString(req.query.state);
        const assignee = toNonEmptyString(req.query.assignee);
        const processInstanceKey = toNonEmptyString(req.query.processInstanceKey);
        const candidateGroup = toNonEmptyString(req.query.candidateGroup);
        const pageSizeRaw = req.query.pageSize;
        const pageSize = typeof pageSizeRaw === "string" && Number.isFinite(Number(pageSizeRaw))
            ? Number(pageSizeRaw)
            : undefined;
        const tasks = await listTasklistTasks({
            ...(state ? { state } : {}),
            ...(assignee ? { assignee } : {}),
            ...(processInstanceKey ? { processInstanceKey } : {}),
            ...(candidateGroup ? { candidateGroup } : {}),
            ...(typeof pageSize === "number" ? { pageSize } : {}),
        });
        return apiSuccess(res, 200, "Tasklist tasks fetched successfully", {
            count: tasks.length,
            items: tasks,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getTaskDetailsController(req, res, next) {
    try {
        const taskId = toNonEmptyString(req.params.taskId);
        if (!taskId) {
            return apiError(res, 400, "Invalid request", {
                taskId: "taskId is required",
            });
        }
        const details = await getTasklistTaskDetails(taskId);
        return apiSuccess(res, 200, "Task details fetched successfully", details);
    }
    catch (error) {
        next(error);
    }
}
async function assignTaskController(req, res, next) {
    try {
        const taskId = toNonEmptyString(req.params.taskId);
        if (!taskId) {
            return apiError(res, 400, "Invalid request", {
                taskId: "taskId is required",
            });
        }
        const assignee = toNonEmptyString(req.body?.assignee) ||
            toNonEmptyString(process.env.CAMUNDA_TASK_ASSIGNEE) ||
            "support-agent";
        if (!assignee) {
            return apiError(res, 400, "Invalid request", {
                assignee: "assignee is required",
            });
        }
        const assigned = await assignTask(taskId, assignee);
        return apiSuccess(res, 200, "Task assigned successfully", assigned);
    }
    catch (error) {
        next(error);
    }
}
async function completeTaskController(req, res, next) {
    try {
        const taskId = toNonEmptyString(req.params.taskId);
        if (!taskId) {
            return apiError(res, 400, "Invalid request", {
                taskId: "taskId is required",
            });
        }
        const variables = coerceVariables(req.body?.variables);
        const completed = await completeTask(taskId, variables);
        return apiSuccess(res, 200, "Task completed successfully", completed);
    }
    catch (error) {
        next(error);
    }
}
export { listTasklistTasksController, getTaskDetailsController, assignTaskController, completeTaskController, };
//# sourceMappingURL=tasklist.controller.js.map