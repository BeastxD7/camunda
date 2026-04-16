import { operateClient } from "../clients/camunda.client.js";
import { prisma } from "../lib/prisma.js";
import { getDataSourceMode } from "./data-source.service.js";

type UnknownRecord = Record<string, unknown>;

function normalizeSearchAfter(values: unknown[]): unknown[] {
	return values.map((value) => {
		if (value && typeof value === "object" && "value" in value) {
			return (value as { value: unknown }).value;
		}

		return value;
	});
}

async function listProcessInstances(pageSize = 100, bpmnProcessId?: string) {
	if ((await getDataSourceMode()) === "db") {
		const query: Parameters<typeof prisma.processInstanceSnapshot.findMany>[0] = {
			orderBy: [{ startDate: "asc" }],
		};
		if (bpmnProcessId) {
			query.where = { bpmnProcessId };
		}

		const rows = await prisma.processInstanceSnapshot.findMany(query);

		return rows.map((row: { rawPayload: unknown; sourceKey: string; bpmnProcessId: string; processVersion: number | null; state: string; startDate: Date | null; endDate: Date | null; tenantId: string | null; incident: boolean }) => ({
			...(row.rawPayload as Record<string, unknown>),
			key: row.sourceKey,
			bpmnProcessId: row.bpmnProcessId,
			processVersion: row.processVersion ?? undefined,
			state: row.state,
			startDate: row.startDate ?? undefined,
			endDate: row.endDate ?? undefined,
			tenantId: row.tenantId ?? undefined,
			incident: row.incident,
		}));
	}

	const all = [];
	let searchAfter: unknown[] | undefined;
	const normalizedBpmnProcessId =
		typeof bpmnProcessId === "string" && bpmnProcessId.trim().length > 0
			? bpmnProcessId.trim()
			: undefined;

	while (true) {
		const response = await operateClient.searchProcessInstances({
			...(normalizedBpmnProcessId
				? { filter: { bpmnProcessId: normalizedBpmnProcessId } }
				: {}),
			size: pageSize,
			sort: [{ field: "key", order: "ASC" }],
			...(searchAfter ? { searchAfter } : {}),
		});

		if (!response.items.length) {
			break;
		}

		all.push(...response.items);

		if (!response.sortValues || response.sortValues.length === 0) {
			break;
		}

		searchAfter = normalizeSearchAfter(response.sortValues);
	}

	return all;
}

async function listProcessVariables(processInstanceKey: string, pageSize = 1000) {
	const all: unknown[] = [];
	let searchAfter: unknown[] | undefined;

	while (true) {
		const response = await operateClient.getVariablesforProcess(processInstanceKey, {
			size: pageSize,
			sort: [{ field: "key", order: "ASC" }],
			...(searchAfter ? { searchAfter } : {}),
		});

		if (!response.items.length) {
			break;
		}

		all.push(...response.items);

		if (!response.sortValues || response.sortValues.length === 0) {
			break;
		}

		searchAfter = normalizeSearchAfter(response.sortValues);
	}

	return all;
}

function parseJsonValue(value: unknown): unknown {
	if (typeof value !== "string") return value;

	const trimmed = value.trim();
	if (!trimmed) return value;

	const maybeJsonLike =
		trimmed.startsWith("{") ||
		trimmed.startsWith("[") ||
		trimmed.startsWith('"{') ||
		trimmed.startsWith('"[');

	if (!maybeJsonLike) {
		return value;
	}

	const parseAttempt = (input: string): unknown | undefined => {
		try {
			return JSON.parse(input);
		} catch {
			return undefined;
		}
	};

	let parsed = parseAttempt(trimmed);

	// Handle double-encoded payloads such as "{\"a\":1}".
	if (typeof parsed === "string") {
		const nested = parseAttempt(parsed);
		if (nested !== undefined) {
			parsed = nested;
		}
	}

	if (parsed !== undefined) {
		return parsed;
	}

	// Best-effort recovery for truncated JSON strings returned by Operate.
	const repaired = repairTruncatedJson(trimmed);
	const repairedParsed = parseAttempt(repaired);
	if (repairedParsed !== undefined) {
		return repairedParsed;
	}

	return value;
}

function repairTruncatedJson(input: string): string {
	let out = input;
	const stack: string[] = [];
	let inString = false;
	let escaped = false;

	for (const char of input) {
		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if (char === '"') {
			inString = !inString;
			continue;
		}

		if (inString) {
			continue;
		}

		if (char === "{" || char === "[") {
			stack.push(char);
			continue;
		}

		if (char === "}" && stack[stack.length - 1] === "{") {
			stack.pop();
			continue;
		}

		if (char === "]" && stack[stack.length - 1] === "[") {
			stack.pop();
		}
	}

	if (inString) {
		out += '"';
	}

	for (let i = stack.length - 1; i >= 0; i -= 1) {
		out += stack[i] === "{" ? "}" : "]";
	}

	return out;
}

function normalizeVariables(items: unknown[]): unknown[] {
	return items.map((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			return item;
		}

		const variable = item as UnknownRecord;
		if (!("value" in variable)) {
			return variable;
		}

		return {
			...variable,
			value: parseJsonValue(variable.value),
		};
	});
}

function extractNormalizedData(variables: unknown[]) {
	const findVar = (name: string) => {
		return variables.find((item) => {
			if (!item || typeof item !== "object") return false;
			const variable = item as UnknownRecord;
			return String(variable.name || "") === name;
		});
	};

	// Look for already-normalized data or construct from raw
	const normalizedVar = findVar("normalized");
	if (normalizedVar && typeof normalizedVar === "object") {
		const parsed = (normalizedVar as UnknownRecord).value;
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
	}

	// Fallback: extract conversation from variables
	const agentContextVar = findVar("agentContext");
	let conversation: UnknownRecord | null = null;

	if (agentContextVar && typeof agentContextVar === "object") {
		const agentValue = (agentContextVar as UnknownRecord).value;
		if (agentValue && typeof agentValue === "object") {
			const agentObj = agentValue as UnknownRecord;
			conversation = (agentObj.conversation || agentObj.messages) as UnknownRecord | null;
		}
	}

	// If no agentContext, look for conversation or messages variable directly
	if (!conversation) {
		const conversationVar = findVar("conversation") || findVar("messages");
		if (conversationVar && typeof conversationVar === "object") {
			const value = (conversationVar as UnknownRecord).value;
			if (Array.isArray(value) || (value && typeof value === "object")) {
				conversation = value as UnknownRecord;
			}
		}
	}

	// Build normalized structure
	let messages: unknown[] = [];
	if (conversation && typeof conversation === "object") {
		if (Array.isArray(conversation)) {
			messages = conversation;
		} else if ("messages" in conversation && Array.isArray(conversation.messages)) {
			messages = conversation.messages;
		}
	}

	return {
		conversationData: {
			type: "support",
			conversationId: "",
			messageCount: messages.length,
			roleCounts: {
				system: 0,
				user: 0,
				assistant: 0,
				tool: 0,
			},
			messages: messages,
		},
	};
}

async function hydrateTruncatedVariables(items: unknown[]): Promise<unknown[]> {
	return Promise.all(
		items.map(async (item) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				return item;
			}

			const variable = item as UnknownRecord & {
				key?: unknown;
				truncated?: unknown;
			};

			if (variable.truncated !== true || typeof variable.key !== "number" && typeof variable.key !== "string") {
				return item;
			}

			try {
				const fullVariable = await operateClient.getVariables(variable.key);
				return {
					...fullVariable,
					value: parseJsonValue(fullVariable.value),
				};
			} catch {
				return {
					...variable,
					value: parseJsonValue(variable.value),
				};
			}
		}),
	);
}

async function getProcessInstanceDetails(instanceKey: string) {
	if ((await getDataSourceMode()) === "db") {
		const row = await prisma.processInstanceSnapshot.findUnique({
			where: { sourceKey: instanceKey },
		});

		if (!row) {
			throw new Error(`Process instance ${instanceKey} not found in demo database`);
		}

		return {
			instance: row.rawPayload as Record<string, unknown>,
			flowNodes: (row.flowNodes as unknown[] | null) ?? [],
			variables: (row.variables as unknown[] | null) ?? [],
			normalized: (row.normalized as Record<string, unknown> | null) ?? extractNormalizedData([]),
		};
	}

	const instance = await operateClient.getProcessInstance(instanceKey);

	const flownodes = await operateClient.searchFlownodeInstances({
		filter: { processInstanceKey: instanceKey },
		size: 500,
	});

	let variables: unknown[] = [];
	try {
		const vars = await listProcessVariables(instanceKey);
		variables = await hydrateTruncatedVariables(normalizeVariables(vars));
	} catch {
		variables = [];
	}

	// Extract conversation data from variables
	const normalizedData = extractNormalizedData(variables);

	return {
		instance,
		flowNodes: flownodes.items,
		variables,
		normalized: normalizedData,
	};
}

export { listProcessInstances, getProcessInstanceDetails };