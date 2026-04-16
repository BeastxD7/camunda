import { orchestrationClient, tasklistClient } from "../clients/camunda.client.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { getDataSourceMode } from "./data-source.service.js";
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
    if ((await getDataSourceMode()) === "db") {
        const rows = await prisma.taskSnapshot.findMany({
            where: {
                ...(filters.state ? { taskState: normalizeTaskState(filters.state) } : {}),
                ...(filters.assignee ? { assignee: filters.assignee } : {}),
                ...(filters.processInstanceKey ? { processInstanceKey: String(filters.processInstanceKey) } : {}),
            },
            orderBy: [{ creationDate: "desc" }],
            take: typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
                ? Math.max(1, Math.min(100, filters.pageSize))
                : 25,
        });
        return rows.map((task) => ({
            id: task.sourceKey,
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
    if ((await getDataSourceMode()) === "db") {
        const row = await prisma.taskSnapshot.findUnique({ where: { sourceKey: taskId } });
        if (!row) {
            throw createHttpError(404, `Task ${taskId} not found in demo database`);
        }
        const stored = row.taskDetails || null;
        if (stored) {
            return stored;
        }
        return {
            task: {
                id: row.sourceKey,
                name: row.name,
                processName: row.processName,
                processInstanceKey: row.processInstanceKey,
                taskState: row.taskState,
                assignee: row.assignee,
                creationDate: row.creationDate,
                dueDate: row.dueDate,
                followUpDate: row.followUpDate,
                tenantId: row.tenantId,
                candidateGroups: row.candidateGroups,
                candidateUsers: row.candidateUsers,
                formKey: row.formKey,
                formId: row.formId,
                formVersion: row.formVersion,
                implementation: row.implementation,
            },
            form: undefined,
            variables: row.variables || {},
            variableEntries: Object.entries(row.variables || {}).map(([name, value]) => ({ name, value })),
        };
    }
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
    if ((await getDataSourceMode()) === "db") {
        await prisma.taskSnapshot.update({
            where: { sourceKey: taskId },
            data: { assignee, taskState: "ASSIGNED" },
        });
        return {
            id: taskId,
            assignee,
            taskState: "ASSIGNED",
        };
    }
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
    if ((await getDataSourceMode()) === "db") {
        const row = await prisma.taskSnapshot.findUnique({ where: { sourceKey: taskId } });
        if (!row) {
            throw createHttpError(404, `Task ${taskId} not found in demo database`);
        }
        if (!row.assignee) {
            throw createHttpError(409, "Task must be assigned before completion. Use Assign To Me first.");
        }
        const updatedDetails = {
            ...(row.taskDetails || {}),
            task: {
                ...(row.taskDetails && typeof row.taskDetails === "object" ? row.taskDetails.task : {}),
                assignee: row.assignee,
                taskState: "COMPLETED",
            },
            variables,
        };
        await prisma.taskSnapshot.update({
            where: { sourceKey: taskId },
            data: {
                taskState: "COMPLETED",
                variables: variables,
                taskDetails: updatedDetails,
            },
        });
        return {
            id: taskId,
            taskState: "COMPLETED",
            variables,
        };
    }
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