import { operateClient } from "../clients/camunda.client.js";
function normalizeSearchAfter(values) {
    return values.map((value) => {
        if (value && typeof value === "object" && "value" in value) {
            return value.value;
        }
        return value;
    });
}
async function listProcessInstances(pageSize = 100, bpmnProcessId) {
    const all = [];
    let searchAfter;
    const normalizedBpmnProcessId = typeof bpmnProcessId === "string" && bpmnProcessId.trim().length > 0
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
async function listProcessVariables(processInstanceKey, pageSize = 1000) {
    const all = [];
    let searchAfter;
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
function parseJsonValue(value) {
    if (typeof value !== "string")
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return value;
    const maybeJsonLike = trimmed.startsWith("{") ||
        trimmed.startsWith("[") ||
        trimmed.startsWith('"{') ||
        trimmed.startsWith('"[');
    if (!maybeJsonLike) {
        return value;
    }
    const parseAttempt = (input) => {
        try {
            return JSON.parse(input);
        }
        catch {
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
function repairTruncatedJson(input) {
    let out = input;
    const stack = [];
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
function normalizeVariables(items) {
    return items.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return item;
        }
        const variable = item;
        if (!("value" in variable)) {
            return variable;
        }
        return {
            ...variable,
            value: parseJsonValue(variable.value),
        };
    });
}
function extractNormalizedData(variables) {
    const findVar = (name) => {
        return variables.find((item) => {
            if (!item || typeof item !== "object")
                return false;
            const variable = item;
            return String(variable.name || "") === name;
        });
    };
    // Look for already-normalized data or construct from raw
    const normalizedVar = findVar("normalized");
    if (normalizedVar && typeof normalizedVar === "object") {
        const parsed = normalizedVar.value;
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
    }
    // Fallback: extract conversation from variables
    const agentContextVar = findVar("agentContext");
    let conversation = null;
    if (agentContextVar && typeof agentContextVar === "object") {
        const agentValue = agentContextVar.value;
        if (agentValue && typeof agentValue === "object") {
            const agentObj = agentValue;
            conversation = (agentObj.conversation || agentObj.messages);
        }
    }
    // If no agentContext, look for conversation or messages variable directly
    if (!conversation) {
        const conversationVar = findVar("conversation") || findVar("messages");
        if (conversationVar && typeof conversationVar === "object") {
            const value = conversationVar.value;
            if (Array.isArray(value) || (value && typeof value === "object")) {
                conversation = value;
            }
        }
    }
    // Build normalized structure
    let messages = [];
    if (conversation && typeof conversation === "object") {
        if (Array.isArray(conversation)) {
            messages = conversation;
        }
        else if ("messages" in conversation && Array.isArray(conversation.messages)) {
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
async function hydrateTruncatedVariables(items) {
    return Promise.all(items.map(async (item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return item;
        }
        const variable = item;
        if (variable.truncated !== true || typeof variable.key !== "number" && typeof variable.key !== "string") {
            return item;
        }
        try {
            const fullVariable = await operateClient.getVariables(variable.key);
            return {
                ...fullVariable,
                value: parseJsonValue(fullVariable.value),
            };
        }
        catch {
            return {
                ...variable,
                value: parseJsonValue(variable.value),
            };
        }
    }));
}
async function getProcessInstanceDetails(instanceKey) {
    const instance = await operateClient.getProcessInstance(instanceKey);
    const flownodes = await operateClient.searchFlownodeInstances({
        filter: { processInstanceKey: instanceKey },
        size: 500,
    });
    let variables = [];
    try {
        const vars = await listProcessVariables(instanceKey);
        variables = await hydrateTruncatedVariables(normalizeVariables(vars));
    }
    catch {
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
//# sourceMappingURL=process-instance.service.js.map