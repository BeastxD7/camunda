import { orchestrationClient, tasklistClient } from "../clients/camunda.client.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { getDataSourceMode } from "./data-source.service.js";

type TaskVariables = Record<string, unknown>;
type TaskVariableEntry = {
	name: string;
	value: unknown;
};

type TaskForm = {
	formId?: string;
	formKey?: string;
	version?: number;
	schema?: Record<string, unknown>;
};

type TaskDetails = {
	task: Record<string, unknown>;
	form?: TaskForm | undefined;
	variables: TaskVariables;
	variableEntries: TaskVariableEntry[];
};

type ListTasklistFilters = {
	state?: string;
	assignee?: string;
	processInstanceKey?: string;
	candidateGroup?: string;
	pageSize?: number;
};

type HttpError = Error & { status: number };

function normalizeTaskState(input?: string): "CREATED" | "COMPLETED" | "CANCELED" | "FAILED" {
	const state = String(input || "CREATED").toUpperCase();
	if (state === "COMPLETED" || state === "CANCELED" || state === "FAILED") {
		return state;
	}
	return "CREATED";
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function createHttpError(status: number, message: string): HttpError {
	return Object.assign(new Error(message), { status });
}

async function listTasklistTasks(filters: ListTasklistFilters = {}) {
	if ((await getDataSourceMode()) === "db") {
		const rows = await prisma.taskSnapshot.findMany({
			where: {
				...(filters.state ? { taskState: normalizeTaskState(filters.state) } : {}),
				...(filters.assignee ? { assignee: filters.assignee } : {}),
				...(filters.processInstanceKey ? { processInstanceKey: String(filters.processInstanceKey) } : {}),
			},
			orderBy: [{ creationDate: "desc" }],
			take:
				typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
					? Math.max(1, Math.min(100, filters.pageSize))
					: 25,
		});

		return rows.map((task: {
			sourceKey: string;
			name: string | null;
			taskDefinitionId: string | null;
			processName: string | null;
			processInstanceKey: string | null;
			taskState: string;
			assignee: string | null;
			creationDate: Date | null;
			dueDate: Date | null;
			followUpDate: Date | null;
			tenantId: string | null;
			candidateGroups: unknown;
			candidateUsers: unknown;
			formKey: string | null;
			formId: string | null;
			formVersion: string | null;
			implementation: string | null;
			variables: unknown;
		}) => ({
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
			candidateGroups: task.candidateGroups as string[] | undefined,
			candidateUsers: task.candidateUsers as string[] | undefined,
			formKey: task.formKey,
			formId: task.formId,
			formVersion: task.formVersion,
			implementation: task.implementation,
			variables: (task.variables as TaskVariables) || {},
		}));
	}

	const tasks = await tasklistClient.searchTasks({
		state: normalizeTaskState(filters.state),
		...(filters.assignee ? { assignee: filters.assignee } : {}),
		...(filters.processInstanceKey
			? { processInstanceKey: String(filters.processInstanceKey) }
			: {}),
		...(filters.candidateGroup ? { candidateGroup: filters.candidateGroup } : {}),
		pageSize:
			typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
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

async function getTasklistTaskDetails(taskId: string): Promise<TaskDetails> {
	if ((await getDataSourceMode()) === "db") {
		const row = await prisma.taskSnapshot.findUnique({ where: { sourceKey: taskId } });
		if (!row) {
			throw createHttpError(404, `Task ${taskId} not found in demo database`);
		}

		const stored = (row.taskDetails as TaskDetails | null) || null;
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
			variables: (row.variables as TaskVariables) || {},
			variableEntries: Object.entries((row.variables as TaskVariables) || {}).map(([name, value]) => ({ name, value })),
		};
	}

	const consistency = { waitUpToMs: 0 };
	const [task, formResponse, variableResponse] = await Promise.all([
		orchestrationClient.getUserTask({ userTaskKey: taskId }, { consistency }),
		orchestrationClient.getUserTaskForm({ userTaskKey: taskId }, { consistency }),
		orchestrationClient.searchUserTaskVariables(
			{ userTaskKey: taskId, truncateValues: false },
			{ consistency },
		),
	]);

	const taskRecord = task as Record<string, unknown>;
	const formRecord = (formResponse || {}) as Record<string, unknown>;
	const parsedSchema = parseMaybeJson(formResponse?.schema);
	const schemaObject =
		parsedSchema && typeof parsedSchema === "object" && !Array.isArray(parsedSchema)
			? (parsedSchema as Record<string, unknown>)
			: undefined;
	let form: TaskForm | undefined;
	if (formResponse) {
		form = {
			...(typeof formRecord.formId === "string" ? { formId: formRecord.formId } : {}),
			...(typeof taskRecord.formKey === "string" ? { formKey: taskRecord.formKey } : {}),
			...(typeof formResponse.version === "number" ? { version: formResponse.version } : {}),
			...(schemaObject ? { schema: schemaObject } : {}),
		};
	}

	const variableItems = Array.isArray((variableResponse as { items?: unknown[] })?.items)
		? ((variableResponse as { items: unknown[] }).items as Array<{ name: unknown; value: unknown }>)
		: [];

	const variableEntries: TaskVariableEntry[] = variableItems.map((item) => ({
		name: String(item.name),
		value: parseMaybeJson(item.value),
	}));

	const variables = variableEntries.reduce((accumulator: TaskVariables, item: TaskVariableEntry) => {
		accumulator[item.name] = item.value;
		return accumulator;
	}, {} as TaskVariables);

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

async function assignTask(taskId: string, assignee: string) {
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

async function completeTask(taskId: string, variables: TaskVariables = {}) {
	if ((await getDataSourceMode()) === "db") {
		const row = await prisma.taskSnapshot.findUnique({ where: { sourceKey: taskId } });
		if (!row) {
			throw createHttpError(404, `Task ${taskId} not found in demo database`);
		}

		if (!row.assignee) {
			throw createHttpError(409, "Task must be assigned before completion. Use Assign To Me first.");
		}

		const updatedDetails = {
			...((row.taskDetails as TaskDetails | null) || {}),
			task: {
				...(row.taskDetails && typeof row.taskDetails === "object" ? (row.taskDetails as TaskDetails).task : {}),
				assignee: row.assignee,
				taskState: "COMPLETED",
			},
			variables,
		};

		await prisma.taskSnapshot.update({
			where: { sourceKey: taskId },
			data: {
				taskState: "COMPLETED",
				variables: variables as Prisma.InputJsonValue,
				taskDetails: updatedDetails as Prisma.InputJsonValue,
			},
		});

		return {
			id: taskId,
			taskState: "COMPLETED",
			variables,
		};
	}

	const consistency = { waitUpToMs: 0 };
	const task = (await orchestrationClient.getUserTask(
		{ userTaskKey: taskId },
		{ consistency },
	)) as Record<string, unknown>;

	const assignee = typeof task.assignee === "string" ? task.assignee.trim() : "";
	if (!assignee) {
		throw createHttpError(
			409,
			"Task must be assigned before completion. Use Assign To Me first.",
		);
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
