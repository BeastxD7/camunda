declare function listProcessInstances(pageSize?: number): Promise<import("@camunda8/sdk/dist/operate/lib/OperateDto.js").ProcessInstance[]>;
declare function getProcessInstanceDetails(instanceKey: string): Promise<{
    instance: import("@camunda8/sdk/dist/operate/lib/OperateDto.js").ProcessInstance;
    flowNodes: import("@camunda8/sdk/dist/operate/lib/OperateDto.js").FlownodeInstance[];
    variables: unknown[];
}>;
export { listProcessInstances, getProcessInstanceDetails };
//# sourceMappingURL=process-instance.service.d.ts.map