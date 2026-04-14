type UnknownRecord = Record<string, unknown>;
type RoleCounts = {
    system: number;
    user: number;
    assistant: number;
    tool: number;
    other: number;
};
export declare function normalizeProcessInstanceDetails(details: {
    instance: unknown;
    flowNodes: unknown[];
    variables: unknown[];
}): {
    instance: UnknownRecord;
    flowNodes: UnknownRecord[];
    variables: UnknownRecord[];
    normalized: {
        flowData: {
            total: number;
            active: number;
            completed: number;
            activeNode: string | null;
            incident: boolean;
        };
        customerData: {
            email: string;
            subject: string;
            messagePreview: string;
            hasReplied: boolean;
            isExistingUser: boolean;
            rawEmail: unknown;
            rawResponseEmail: unknown;
        };
        previousConversationData: {
            available: boolean;
            chunkCount: number;
            topScore: number;
            averageScore: number;
            conversationInsights: {
                customerTurns: number;
                assistantTurns: number;
                hasResolutionSignal: boolean;
                latestStatus: string;
                keyLesson: string;
            };
            topChunks: never[];
            raw?: never;
        } | {
            available: boolean;
            chunkCount: number;
            topScore: number;
            averageScore: number;
            conversationInsights: {
                customerTurns: number;
                assistantTurns: number;
                hasResolutionSignal: boolean;
                latestStatus: string;
                keyLesson: string;
            };
            topChunks: {
                chunkId: string;
                score: number;
                preview: string;
                documentId: string;
                fileName: string;
            }[];
            raw: unknown;
        };
        conversationData: {
            type: string;
            conversationId: string;
            messageCount: number;
            roleCounts: RoleCounts;
            messages: {
                index: number;
                role: string;
                contentPreview: string;
                content: unknown;
                raw: unknown;
            }[];
        };
        agentData: {
            type: string;
            state: string;
            conversation: {
                type: string;
                conversationId: string;
                messageCount: number;
                roleCounts: RoleCounts;
                messages: {
                    index: number;
                    role: string;
                    contentPreview: string;
                    content: unknown;
                    raw: unknown;
                }[];
            };
            metrics: {
                modelCalls: number;
                inputTokenCount: number;
                outputTokenCount: number;
                totalTokens: number;
            };
            toolDefinitions: {
                name: string;
                description: string;
                inputSchema: unknown;
            }[];
            systemPrompt: {
                hasPrompt: boolean;
                preview: string;
            };
        };
        toolTrace: {
            scopeKey: string;
            toolName: string;
            parameters: UnknownRecord;
            result: unknown;
            summary: string;
        }[];
        securityData: {
            sensitiveVariableCount: number;
            sensitiveVariableNames: string[];
        };
        parsedVariables: {
            count: number;
            items: {
                key: string;
                scopeKey: string;
                name: string;
                truncated: boolean;
                wasJsonString: boolean;
                parsedType: string;
                value: unknown;
            }[];
            byName: Record<string, unknown[]>;
        };
    };
    rawPayload: unknown;
};
export {};
//# sourceMappingURL=process-instance-normalizer.d.ts.map