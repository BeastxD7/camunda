declare function listProcessInstances(pageSize?: number, bpmnProcessId?: string): Promise<{
    key: string;
    bpmnProcessId: string;
    processVersion: number | undefined;
    state: string;
    startDate: Date | undefined;
    endDate: Date | undefined;
    tenantId: string | undefined;
    incident: boolean;
}[] | import("@camunda8/sdk/dist/operate/lib/OperateDto.js").ProcessInstance[]>;
declare function getProcessInstanceDetails(instanceKey: string): Promise<{
    instance: Record<string, unknown>;
    flowNodes: unknown[];
    variables: unknown[];
    normalized: object;
} | {
    instance: import("@camunda8/sdk/dist/operate/lib/OperateDto.js").ProcessInstance;
    flowNodes: import("@camunda8/sdk/dist/operate/lib/OperateDto.js").FlownodeInstance[];
    variables: unknown[];
    normalized: object;
}>;
export { listProcessInstances, getProcessInstanceDetails };
//# sourceMappingURL=process-instance.service.d.ts.map