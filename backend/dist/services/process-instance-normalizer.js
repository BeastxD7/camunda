const SENSITIVE_KEY = /password|secret|accesskey|token|authorization|authentication/i;
function safeParseJson(input) {
    if (typeof input !== "string")
        return input;
    try {
        return JSON.parse(input);
    }
    catch {
        return input;
    }
}
function extractAgentContextFromTruncatedString(raw) {
    if (!raw || !raw.includes("agent") && !raw.includes("conversation") && !raw.includes("modelCalls")) {
        return null;
    }
    const state = raw.match(/"state":"([^"]+)"/)?.[1] || "";
    const modelCalls = Number(raw.match(/"modelCalls":(\d+)/)?.[1] || 0);
    const inputTokenCount = Number(raw.match(/"inputTokenCount":(\d+)/)?.[1] || 0);
    const outputTokenCount = Number(raw.match(/"outputTokenCount":(\d+)/)?.[1] || 0);
    const conversationType = raw.match(/"conversation"\s*:\s*\{\s*"type":"([^"]+)"/)?.[1] || "";
    const conversationId = raw.match(/"conversationId":"([^"]+)"/)?.[1] || "";
    const roleMatches = raw.match(/"role":"(system|user|assistant|tool)"/g) || [];
    const roleCounts = { system: 0, user: 0, assistant: 0, tool: 0, other: 0 };
    for (const roleToken of roleMatches) {
        if (roleToken.includes('"system"'))
            roleCounts.system += 1;
        else if (roleToken.includes('"user"'))
            roleCounts.user += 1;
        else if (roleToken.includes('"assistant"'))
            roleCounts.assistant += 1;
        else if (roleToken.includes('"tool"'))
            roleCounts.tool += 1;
    }
    const toolNameMatches = Array.from(raw.matchAll(/"name":"([^"]+)"/g)).map((match) => match[1]).filter(Boolean);
    const uniqueToolNames = Array.from(new Set(toolNameMatches));
    const hasSignal = Boolean(state ||
        modelCalls ||
        inputTokenCount ||
        outputTokenCount ||
        conversationId ||
        conversationType ||
        uniqueToolNames.length);
    if (!hasSignal)
        return null;
    return {
        state,
        metrics: {
            modelCalls,
            tokenUsage: {
                inputTokenCount,
                outputTokenCount,
            },
        },
        conversation: {
            type: conversationType,
            conversationId,
            messages: [],
            roleCounts,
            messageCount: roleMatches.length,
        },
        toolDefinitions: uniqueToolNames.map((name) => ({ name })),
    };
}
function toRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    return value;
}
function sanitizeValue(value) {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === "object") {
        const record = value;
        const sanitized = {};
        for (const [key, nestedValue] of Object.entries(record)) {
            if (SENSITIVE_KEY.test(key)) {
                sanitized[key] = "[REDACTED]";
            }
            else {
                sanitized[key] = sanitizeValue(nestedValue);
            }
        }
        return sanitized;
    }
    return value;
}
function sanitizeText(value, limit = 240) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}
function findVariable(variables, names) {
    for (const name of names) {
        const variable = variables.find((item) => String(item.name || "") === name);
        if (variable)
            return variable;
    }
    return undefined;
}
function getConversationMessageText(message) {
    const content = message.content;
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => {
            const partRecord = toRecord(part);
            if (!partRecord)
                return typeof part === "string" ? part : "";
            return String(partRecord.text || partRecord.content || partRecord.value || "");
        })
            .filter(Boolean)
            .join(" ");
    }
    return String(message.text || message.value || "");
}
function buildToolTrace(variables) {
    const scoped = new Map();
    for (const raw of variables) {
        const name = String(raw.name || "");
        const scopeKey = String(raw.scopeKey || raw.key || "");
        if (!scopeKey)
            continue;
        const parsed = safeParseJson(raw.value);
        const entry = scoped.get(scopeKey) || {};
        if (name === "toolCall") {
            entry.call = toRecord(parsed) || { value: parsed };
        }
        if (name === "toolCallResult") {
            entry.result = sanitizeValue(parsed);
        }
        scoped.set(scopeKey, entry);
    }
    return Array.from(scoped.entries())
        .filter(([, entry]) => entry.call)
        .map(([scopeKey, entry]) => {
        const call = entry.call || {};
        const meta = toRecord(call._meta);
        const parameters = {};
        for (const [key, value] of Object.entries(call)) {
            if (key === "_meta")
                continue;
            parameters[key] = sanitizeValue(value);
        }
        let summary = "No result captured";
        const result = entry.result;
        if (result !== undefined && result !== null) {
            const resultRecord = toRecord(result);
            const chunks = resultRecord && Array.isArray(resultRecord.chunks)
                ? resultRecord.chunks
                : null;
            if (chunks && chunks.length > 0) {
                const first = chunks[0];
                const score = typeof first.score === "number" ? first.score.toFixed(3) : "-";
                summary = `${chunks.length} evidence chunk(s), top score ${score}`;
            }
            else if (typeof result === "string" && result.trim() === "") {
                summary = "Executed successfully (empty output)";
            }
            else {
                summary = "Result payload available";
            }
        }
        return {
            scopeKey,
            toolName: String(meta?.name || "Unknown tool"),
            parameters,
            result,
            summary,
        };
    });
}
function findAgentContext(variables) {
    const preferredNames = ["agentContext", "agent_context", "runtimeContext", "agentRuntime", "data", "context"];
    const preferredAgentVariable = variables.find((item) => String(item.name || "") === "agentContext" || String(item.name || "") === "agent_context");
    if (preferredAgentVariable) {
        const parsed = unwrapRuntimeContext(safeParseJson(preferredAgentVariable.value));
        if (parsed)
            return parsed;
        if (typeof preferredAgentVariable.value === "string") {
            const recovered = extractAgentContextFromTruncatedString(preferredAgentVariable.value);
            if (recovered)
                return recovered;
        }
    }
    for (const name of preferredNames) {
        const variable = variables.find((item) => String(item.name || "") === name);
        if (!variable)
            continue;
        const parsed = unwrapRuntimeContext(safeParseJson(variable?.value));
        if (parsed)
            return parsed;
        if (name === "agentContext" || name === "agent_context") {
            if (typeof variable.value === "string") {
                const recovered = extractAgentContextFromTruncatedString(variable.value);
                if (recovered)
                    return recovered;
            }
        }
    }
    for (const variable of variables) {
        const parsed = unwrapRuntimeContext(safeParseJson(variable.value));
        if (parsed)
            return parsed;
    }
    return null;
}
function unwrapRuntimeContext(value) {
    const record = toRecord(value);
    if (!record)
        return null;
    if (record.metrics ||
        record.conversation ||
        record.toolDefinitions ||
        record.systemPrompt) {
        return record;
    }
    const nestedCandidates = [record.agentContext, record.data, record.context, record.runtime];
    for (const candidate of nestedCandidates) {
        const nested = unwrapRuntimeContext(candidate);
        if (nested)
            return nested;
    }
    return null;
}
function buildConversationData(agentContext) {
    const conversation = toRecord(agentContext?.conversation);
    const messages = Array.isArray(conversation?.messages) ? conversation?.messages : [];
    const roleCounts = messages.reduce((counts, message) => {
        const role = String(toRecord(message)?.role || "other").toLowerCase();
        if (role === "system")
            counts.system += 1;
        else if (role === "user")
            counts.user += 1;
        else if (role === "assistant")
            counts.assistant += 1;
        else if (role === "tool")
            counts.tool += 1;
        else
            counts.other += 1;
        return counts;
    }, { system: 0, user: 0, assistant: 0, tool: 0, other: 0 });
    const messagesWithPreview = messages.map((message, index) => {
        const messageRecord = toRecord(message) || {};
        return {
            index: index + 1,
            role: String(messageRecord.role || "unknown"),
            contentPreview: sanitizeText(getConversationMessageText(messageRecord), 320),
            content: sanitizeValue(messageRecord.content),
            raw: sanitizeValue(messageRecord),
        };
    });
    return {
        type: String(conversation?.type || ""),
        conversationId: String(conversation?.conversationId || ""),
        messageCount: messages.length,
        roleCounts,
        messages: messagesWithPreview,
    };
}
function buildAgentData(agentContext) {
    const metrics = toRecord(agentContext?.metrics) || {};
    const tokenUsage = toRecord(metrics.tokenUsage) || {};
    const conversationData = buildConversationData(agentContext);
    const toolDefinitions = Array.isArray(agentContext?.toolDefinitions)
        ? agentContext.toolDefinitions
        : [];
    const systemPrompt = toRecord(agentContext?.systemPrompt);
    const systemPromptText = String(systemPrompt?.prompt || "");
    const inputTokens = Number(tokenUsage.inputTokenCount || 0);
    const outputTokens = Number(tokenUsage.outputTokenCount || 0);
    return {
        type: String(agentContext?.type || ""),
        state: String(agentContext?.state || ""),
        conversation: conversationData,
        metrics: {
            modelCalls: Number(metrics.modelCalls || 0),
            inputTokenCount: inputTokens,
            outputTokenCount: outputTokens,
            totalTokens: inputTokens + outputTokens,
        },
        toolDefinitions: toolDefinitions.map((tool) => ({
            name: String(toRecord(tool)?.name || ""),
            description: String(toRecord(tool)?.description || ""),
            inputSchema: sanitizeValue(toRecord(tool)?.inputSchema),
        })),
        systemPrompt: {
            hasPrompt: Boolean(systemPromptText),
            preview: sanitizeText(systemPromptText, 220),
        },
    };
}
function buildCustomerData(variables) {
    const currentEmail = toRecord(safeParseJson(findVariable(variables, ["currentEmail"])?.value));
    const responseEmail = toRecord(safeParseJson(findVariable(variables, ["responseEmail", "ourReplyEmail"])?.value));
    const isExistingUser = safeParseJson(findVariable(variables, ["isExistingUser"])?.value);
    return {
        email: String(currentEmail?.fromAddress || ""),
        subject: String(currentEmail?.subject || ""),
        messagePreview: sanitizeText(String(currentEmail?.plainTextBody || ""), 240),
        hasReplied: Boolean(responseEmail?.sent),
        isExistingUser: Array.isArray(isExistingUser) && isExistingUser.length > 0,
        rawEmail: sanitizeValue(currentEmail),
        rawResponseEmail: sanitizeValue(responseEmail),
    };
}
function buildPreviousConversationData(variables) {
    const previousConversationVar = findVariable(variables, ["customerPreviousConversationContext"]);
    if (!previousConversationVar) {
        return {
            available: false,
            chunkCount: 0,
            topScore: 0,
            averageScore: 0,
            conversationInsights: {
                customerTurns: 0,
                assistantTurns: 0,
                hasResolutionSignal: false,
                latestStatus: "unknown",
                keyLesson: "",
            },
            topChunks: [],
        };
    }
    const parsed = safeParseJson(previousConversationVar.value);
    const parsedRecord = toRecord(parsed);
    const chunks = parsedRecord && Array.isArray(parsedRecord.chunks)
        ? parsedRecord.chunks
        : [];
    const scores = chunks
        .map((chunk) => Number(chunk.score || 0))
        .filter((score) => Number.isFinite(score) && score > 0);
    const topScore = scores.length ? Math.max(...scores) : 0;
    const averageScore = scores.length
        ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(4))
        : 0;
    const combinedContent = chunks
        .map((chunk) => String(chunk.content || ""))
        .join("\n\n")
        .replace(/\\r\\n/g, "\n");
    const customerTurns = (combinedContent.match(/(^|\n)\s*user\s*:/gi) || []).length;
    const assistantTurns = (combinedContent.match(/(^|\n)\s*assistant\s*:/gi) || []).length;
    const hasResolutionSignal = /(status\s*:\s*resolved|thank you for your assistance|issue has been successfully resolved|resolved)/i.test(combinedContent);
    const latestStatusMatch = combinedContent.match(/status\s*:\s*([a-z_\- ]+)/i);
    const keyLessonMatch = combinedContent.match(/key lesson(?: noted)?\s*:\s*([^\n]+)/i);
    const topChunks = [...chunks]
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 3)
        .map((chunk) => ({
        chunkId: String(chunk.chunkId || ""),
        score: Number(chunk.score || 0),
        preview: sanitizeText(chunk.content, 320),
        documentId: String(toRecord(chunk.documentReference)?.documentId || ""),
        fileName: String(toRecord(toRecord(chunk.documentReference)?.metadata)?.fileName || ""),
    }));
    return {
        available: chunks.length > 0,
        chunkCount: chunks.length,
        topScore,
        averageScore,
        conversationInsights: {
            customerTurns,
            assistantTurns,
            hasResolutionSignal,
            latestStatus: latestStatusMatch ? sanitizeText(latestStatusMatch[1], 40).toLowerCase() : "unknown",
            keyLesson: keyLessonMatch ? sanitizeText(keyLessonMatch[1], 200) : "",
        },
        topChunks,
        raw: sanitizeValue(parsed),
    };
}
function buildSecurityData(variables) {
    const sensitiveVariables = variables.filter((item) => SENSITIVE_KEY.test(String(item.name || "")));
    return {
        sensitiveVariableCount: sensitiveVariables.length,
        sensitiveVariableNames: sensitiveVariables.map((item) => String(item.name || "")).filter(Boolean),
    };
}
function buildFlowData(instance, flowNodes) {
    const activeNodes = flowNodes.filter((node) => String(node.state || "") === "ACTIVE");
    const completedNodes = flowNodes.filter((node) => String(node.state || "") === "COMPLETED");
    return {
        total: flowNodes.length,
        active: activeNodes.length,
        completed: completedNodes.length,
        activeNode: String(activeNodes[0]?.flowNodeName || activeNodes[0]?.flowNodeId || "") || null,
        incident: Boolean(instance.incident),
    };
}
function buildParsedVariables(variables) {
    const parsedVariables = variables.map((item) => {
        const rawValue = item.value;
        const parsedValue = safeParseJson(rawValue);
        const parsedType = Array.isArray(parsedValue)
            ? "array"
            : parsedValue === null
                ? "null"
                : typeof parsedValue;
        return {
            key: String(item.key || ""),
            scopeKey: String(item.scopeKey || ""),
            name: String(item.name || ""),
            truncated: Boolean(item.truncated),
            wasJsonString: typeof rawValue === "string" && typeof parsedValue !== "string",
            parsedType,
            value: sanitizeValue(parsedValue),
        };
    });
    const byName = {};
    for (const variable of parsedVariables) {
        if (!variable.name)
            continue;
        if (!byName[variable.name]) {
            byName[variable.name] = [];
        }
        byName[variable.name].push(variable.value);
    }
    return {
        count: parsedVariables.length,
        items: parsedVariables,
        byName,
    };
}
export function normalizeProcessInstanceDetails(details) {
    const instance = toRecord(details.instance) || {};
    const flowNodes = details.flowNodes.map((item) => toRecord(item) || {});
    const variables = details.variables.map((item) => toRecord(item) || {});
    const agentContext = findAgentContext(variables);
    const toolTrace = buildToolTrace(variables);
    return {
        instance,
        flowNodes,
        variables,
        normalized: {
            flowData: buildFlowData(instance, flowNodes),
            customerData: buildCustomerData(variables),
            previousConversationData: buildPreviousConversationData(variables),
            conversationData: buildConversationData(agentContext),
            agentData: buildAgentData(agentContext),
            toolTrace,
            securityData: buildSecurityData(variables),
            parsedVariables: buildParsedVariables(variables),
        },
        rawPayload: sanitizeValue({
            instance,
            flowNodes,
            variables,
        }),
    };
}
//# sourceMappingURL=process-instance-normalizer.js.map