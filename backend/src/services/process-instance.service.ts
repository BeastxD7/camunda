import { operateClient } from "../clients/camunda.client.js";

type UnknownRecord = Record<string, unknown>;

function normalizeSearchAfter(values: unknown[]): unknown[] {
	return values.map((value) => {
		if (value && typeof value === "object" && "value" in value) {
			return (value as { value: unknown }).value;
		}

		return value;
	});
}

async function listProcessInstances(pageSize = 100) {
	const all = [];
	let searchAfter: unknown[] | undefined;

	while (true) {
		const response = await operateClient.searchProcessInstances({
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

	return {
		instance,
		flowNodes: flownodes.items,
		variables,
	};
}

export { listProcessInstances, getProcessInstanceDetails };