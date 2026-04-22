import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { getProcessInstanceDetails, listProcessInstances } from "./process-instance.service.js";
import { getTasklistTaskDetails, listTasklistTasks } from "./tasklist.service.js";
import {
	exportDashboardDefinitions,
	getDashboardIds,
	getReportData,
	getReportIds,
} from "./optimize.service.js";
import { runWithDataSourceMode } from "./data-source.service.js";

type ProcessSnapshot = {
	instance: Record<string, unknown>;
	flowNodes: unknown[];
	variables: unknown[];
	normalized: Record<string, unknown>;
};

type DemoProcessInstance = {
	key: string | number;
	bpmnProcessId?: string;
	processVersion?: number;
	state?: string;
	startDate?: string | Date;
	endDate?: string | Date;
	tenantId?: string;
	incident?: boolean;
};

type DemoTaskInstance = {
	id: string | number;
	name?: string;
	taskDefinitionId?: string;
	processName?: string;
	processInstanceKey?: string;
	taskState?: string;
	assignee?: string;
	creationDate?: string | Date;
	dueDate?: string | Date;
	followUpDate?: string | Date;
	tenantId?: string;
	candidateGroups?: string[];
	candidateUsers?: string[];
	formKey?: string;
	formId?: string;
	formVersion?: string;
	implementation?: string;
};

async function syncProcessInstances(pageSize = 100) {
	const processInstances = (await listProcessInstances(pageSize)) as DemoProcessInstance[];
	let synced = 0;

	for (const processInstance of processInstances) {
		const instanceKey = String(processInstance.key);
		const details = (await getProcessInstanceDetails(instanceKey)) as ProcessSnapshot;

		await prisma.processInstanceSnapshot.upsert({
			where: { sourceKey: instanceKey },
			create: {
				sourceKey: instanceKey,
				source: "camunda",
				bpmnProcessId: String(processInstance.bpmnProcessId || ""),
				processVersion: typeof processInstance.processVersion === "number" ? processInstance.processVersion : null,
				state: String(processInstance.state || ""),
				startDate: processInstance.startDate ? new Date(String(processInstance.startDate)) : null,
				endDate: processInstance.endDate ? new Date(String(processInstance.endDate)) : null,
				tenantId: typeof processInstance.tenantId === "string" ? processInstance.tenantId : null,
				incident: Boolean(processInstance.incident),
				rawPayload: details.instance as Prisma.InputJsonValue,
				variables: details.variables as Prisma.InputJsonValue,
				flowNodes: details.flowNodes as Prisma.InputJsonValue,
				normalized: details.normalized as Prisma.InputJsonValue,
			},
			update: {
				bpmnProcessId: String(processInstance.bpmnProcessId || ""),
				processVersion: typeof processInstance.processVersion === "number" ? processInstance.processVersion : null,
				state: String(processInstance.state || ""),
				startDate: processInstance.startDate ? new Date(String(processInstance.startDate)) : null,
				endDate: processInstance.endDate ? new Date(String(processInstance.endDate)) : null,
				tenantId: typeof processInstance.tenantId === "string" ? processInstance.tenantId : null,
				incident: Boolean(processInstance.incident),
				rawPayload: details.instance as Prisma.InputJsonValue,
				variables: details.variables as Prisma.InputJsonValue,
				flowNodes: details.flowNodes as Prisma.InputJsonValue,
				normalized: details.normalized as Prisma.InputJsonValue,
			},
		});
		synced += 1;
	}

	return { count: synced };
}

async function syncTasks(pageSize = 100) {
	const tasks = (await listTasklistTasks({ pageSize })) as DemoTaskInstance[];
	let synced = 0;

	for (const task of tasks) {
		const taskId = String(task.id);
		const details = await getTasklistTaskDetails(taskId);

		await prisma.taskSnapshot.upsert({
			where: { sourceKey: taskId },
			create: {
				sourceKey: taskId,
				source: "camunda",
				taskState: String(task.taskState || "CREATED"),
				name: task.name || null,
				taskDefinitionId: task.taskDefinitionId || null,
				processName: task.processName || null,
				processInstanceKey: task.processInstanceKey || null,
				assignee: task.assignee || null,
				creationDate: task.creationDate ? new Date(String(task.creationDate)) : null,
				dueDate: task.dueDate ? new Date(String(task.dueDate)) : null,
				followUpDate: task.followUpDate ? new Date(String(task.followUpDate)) : null,
				tenantId: task.tenantId || null,
				candidateGroups: task.candidateGroups as never,
				candidateUsers: task.candidateUsers as never,
				formKey: task.formKey || null,
				formId: task.formId || null,
				formVersion: task.formVersion ? String(task.formVersion) : null,
				implementation: task.implementation || null,
				variables: details.variables as Prisma.InputJsonValue,
				taskDetails: details as Prisma.InputJsonValue,
			},
			update: {
				taskState: String(task.taskState || "CREATED"),
				name: task.name || null,
				taskDefinitionId: task.taskDefinitionId || null,
				processName: task.processName || null,
				processInstanceKey: task.processInstanceKey || null,
				assignee: task.assignee || null,
				creationDate: task.creationDate ? new Date(String(task.creationDate)) : null,
				dueDate: task.dueDate ? new Date(String(task.dueDate)) : null,
				followUpDate: task.followUpDate ? new Date(String(task.followUpDate)) : null,
				tenantId: task.tenantId || null,
				candidateGroups: task.candidateGroups as never,
				candidateUsers: task.candidateUsers as never,
				formKey: task.formKey || null,
				formId: task.formId || null,
				formVersion: task.formVersion ? String(task.formVersion) : null,
				implementation: task.implementation || null,
				variables: details.variables as Prisma.InputJsonValue,
				taskDetails: details as Prisma.InputJsonValue,
			},
		});
		synced += 1;
	}

	return { count: synced };
}

async function syncOptimize(collectionId: string) {
	const dashboardIdsResponse = (await getDashboardIds(collectionId)) as Array<{ id?: string }>;
	const reportIdsResponse = (await getReportIds(collectionId)) as Array<{ id?: string }>;
	const dashboardIds = Array.isArray(dashboardIdsResponse)
		? dashboardIdsResponse
			.map((item) => (item && typeof item === "object" && "id" in item ? String((item as { id?: unknown }).id || "") : ""))
			.filter(Boolean)
		: [];
	const reportIds = Array.isArray(reportIdsResponse)
		? reportIdsResponse
			.map((item) => (item && typeof item === "object" && "id" in item ? String((item as { id?: unknown }).id || "") : ""))
			.filter(Boolean)
		: [];

	const dashboardDefinitionsRaw = await exportDashboardDefinitions(dashboardIds);
	const dashboardDefinitions = Array.isArray(dashboardDefinitionsRaw)
		? (dashboardDefinitionsRaw as Array<Record<string, unknown>>)
		: [];
	const reportDefinitions = dashboardDefinitions.filter(
		(item) => item && item.exportEntityType === "single_process_report",
	) as Array<Record<string, unknown>>;
	const reportDefinitionById = new Map(
		reportDefinitions
			.map((definition) => [String(definition.id || ""), definition] as const)
			.filter(([id]) => Boolean(id)),
	);

	let dashboardsSynced = 0;
	for (const dashboard of dashboardDefinitions.filter((item) => item && item.exportEntityType === "dashboard")) {
		const dashboardId = String(dashboard.id || "");
		if (!dashboardId) continue;
		const reportIdsForDashboard = Array.isArray((dashboard as { tiles?: Array<{ id?: string }> }).tiles)
			? (dashboard as { tiles?: Array<{ id?: string }> }).tiles!.map((tile) => String(tile.id || "")).filter(Boolean)
			: [];
		const reportDefinitionsForDashboard = reportIdsForDashboard
			.map((reportId) => reportDefinitionById.get(reportId))
			.filter((definition): definition is Record<string, unknown> => Boolean(definition));

		const reportsDataPayload = {
			reportIds: reportIdsForDashboard,
			reportDefinitions: reportDefinitionsForDashboard,
		};

		await prisma.optimizeDashboardSnapshot.upsert({
			where: { sourceKey: dashboardId },
			create: {
				sourceKey: dashboardId,
				source: "camunda",
				collectionId,
				name: typeof dashboard.name === "string" ? dashboard.name : null,
				description: typeof dashboard.description === "string" ? dashboard.description : null,
				dashboardId,
				dashboardData: dashboard as Prisma.InputJsonValue,
				reportsData: reportsDataPayload as Prisma.InputJsonValue,
			},
			update: {
				collectionId,
				name: typeof dashboard.name === "string" ? dashboard.name : null,
				description: typeof dashboard.description === "string" ? dashboard.description : null,
				dashboardId,
				dashboardData: dashboard as Prisma.InputJsonValue,
				reportsData: reportsDataPayload as Prisma.InputJsonValue,
			},
		});
		dashboardsSynced += 1;
	}

	let reportsSynced = 0;
	for (const reportId of reportIds) {
		const reportData = await getReportData(reportId);
		const reportDefinition = reportDefinitionById.get(reportId);
		await prisma.optimizeReportSnapshot.upsert({
			where: { sourceKey: reportId },
			create: {
				sourceKey: reportId,
				source: "camunda",
				collectionId,
				dashboardId: null,
				reportId,
				name: typeof reportDefinition?.name === "string" ? reportDefinition.name : null,
				description: typeof reportDefinition?.description === "string" ? reportDefinition.description : null,
				reportData: reportData as Prisma.InputJsonValue,
			},
			update: {
				collectionId,
				reportId,
				name: typeof reportDefinition?.name === "string" ? reportDefinition.name : null,
				description: typeof reportDefinition?.description === "string" ? reportDefinition.description : null,
				reportData: reportData as Prisma.InputJsonValue,
			},
		});
		reportsSynced += 1;
	}

	return { dashboardsSynced, reportsSynced };
}

async function syncAllDemoData(collectionId: string) {
	const [processes, tasks, optimize] = await runWithDataSourceMode("camunda", async () =>
		Promise.all([
			syncProcessInstances(),
			syncTasks(),
			syncOptimize(collectionId),
		]),
	);

	return { processes, tasks, optimize };
}

export {
	syncAllDemoData,
	syncOptimize,
	syncProcessInstances,
	syncTasks,
};