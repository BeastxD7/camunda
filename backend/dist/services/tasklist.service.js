import { orchestrationClient, tasklistClient } from "../clients/camunda.client.js";
function normalizeTaskState(input) {
    const state = String(input || "CREATED").toUpperCase();
    if (state === "COMPLETED" || state === "CANCELED" || state === "FAILED") {
        return state;
    }
    return "CREATED";
}
function parseMaybeJson(value) {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
function createHttpError(status, message) {
    return Object.assign(new Error(message), { status });
}
async function listTasklistTasks(filters = {}) {
    const tasks = await tasklistClient.searchTasks({
        state: normalizeTaskState(filters.state),
        ...(filters.assignee ? { assignee: filters.assignee } : {}),
        ...(filters.processInstanceKey
            ? { processInstanceKey: String(filters.processInstanceKey) }
            : {}),
        ...(filters.candidateGroup ? { candidateGroup: filters.candidateGroup } : {}),
        pageSize: typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
            ? Math.max(1, Math.min(100, filters.pageSize))
            : 25,
        sort: [{ field: "creationTime", order: "DESC" }],
    });
    return tasks.map((task) => ({
        id: task.id,
        name: task.name,
        taskDefinitionId: task.taskDefinitionId,
        processName: task.processName,
        processInstanceKey: task.processInstanceKey,
        taskState: task.taskState,
        assignee: task.assignee,
        creationDate: task.creationDate,
        dueDate: task.dueDate,
        followUpDate: task.followUpDate,
        tenantId: task.tenantId,
        candidateGroups: task.candidateGroups,
        candidateUsers: task.candidateUsers,
        formKey: task.formKey,
        formId: task.formId,
        formVersion: task.formVersion,
        implementation: task.implementation,
        variables: task.variables || {},
    }));
}
async function getTasklistTaskDetails(taskId) {
    const consistency = { waitUpToMs: 0 };
    const [task, formResponse, variableResponse] = await Promise.all([
        orchestrationClient.getUserTask({ userTaskKey: taskId }, { consistency }),
        orchestrationClient.getUserTaskForm({ userTaskKey: taskId }, { consistency }),
        orchestrationClient.searchUserTaskVariables({ userTaskKey: taskId, truncateValues: false }, { consistency }),
    ]);
    const taskRecord = task;
    const formRecord = (formResponse || {});
    const parsedSchema = parseMaybeJson(formResponse?.schema);
    const schemaObject = parsedSchema && typeof parsedSchema === "object" && !Array.isArray(parsedSchema)
        ? parsedSchema
        : undefined;
    let form;
    if (formResponse) {
        form = {
            ...(typeof formRecord.formId === "string" ? { formId: formRecord.formId } : {}),
            ...(typeof taskRecord.formKey === "string" ? { formKey: taskRecord.formKey } : {}),
            ...(typeof formResponse.version === "number" ? { version: formResponse.version } : {}),
            ...(schemaObject ? { schema: schemaObject } : {}),
        };
    }
    const variableItems = Array.isArray(variableResponse?.items)
        ? variableResponse.items
        : [];
    const variableEntries = variableItems.map((item) => ({
        name: String(item.name),
        value: parseMaybeJson(item.value),
    }));
    const variables = variableEntries.reduce((accumulator, item) => {
        accumulator[item.name] = item.value;
        return accumulator;
    }, {});
    return {
        task: {
            id: typeof taskRecord.userTaskKey === "string" ? taskRecord.userTaskKey : taskId,
            name: taskRecord.name,
            taskDefinitionId: taskRecord.taskDefinitionId,
            processName: taskRecord.processName,
            processInstanceKey: taskRecord.processInstanceKey,
            taskState: taskRecord.state,
            assignee: taskRecord.assignee,
            creationDate: taskRecord.creationDate,
            dueDate: taskRecord.dueDate,
            followUpDate: taskRecord.followUpDate,
            tenantId: taskRecord.tenantId,
            candidateGroups: taskRecord.candidateGroups,
            candidateUsers: taskRecord.candidateUsers,
            formKey: taskRecord.formKey,
            formId: taskRecord.formKey,
            formVersion: formResponse?.version,
            implementation: taskRecord.state,
        },
        form,
        variables,
        variableEntries,
    };
}
async function assignTask(taskId, assignee) {
    await orchestrationClient.assignUserTask({
        userTaskKey: taskId,
        assignee,
        allowOverride: true,
        action: "assign",
    });
    return {
        id: taskId,
        assignee,
        taskState: "ASSIGNED",
    };
}
async function completeTask(taskId, variables = {}) {
    const consistency = { waitUpToMs: 0 };
    const task = (await orchestrationClient.getUserTask({ userTaskKey: taskId }, { consistency }));
    const assignee = typeof task.assignee === "string" ? task.assignee.trim() : "";
    if (!assignee) {
        throw createHttpError(409, "Task must be assigned before completion. Use Assign To Me first.");
    }
    await orchestrationClient.completeUserTask({
        userTaskKey: taskId,
        variables,
        action: "complete",
    });
    return {
        id: taskId,
        taskState: "COMPLETED",
        variables,
    };
}
export { listTasklistTasks, getTasklistTaskDetails, assignTask, completeTask };
//# sourceMappingURL=tasklist.service.js.map