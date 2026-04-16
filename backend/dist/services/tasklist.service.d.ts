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
declare function listTasklistTasks(filters?: ListTasklistFilters): Promise<{
    id: string;
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
    candidateGroups: string[] | undefined;
    candidateUsers: string[] | undefined;
    formKey: string | null;
    formId: string | null;
    formVersion: string | null;
    implementation: string | null;
    variables: TaskVariables;
}[] | {
    id: string;
    name: string;
    taskDefinitionId: string;
    processName: string;
    processInstanceKey: string;
    taskState: "CANCELED" | "COMPLETED" | "CREATED" | "FAILED";
    assignee: string;
    creationDate: string;
    dueDate: string;
    followUpDate: string;
    tenantId: string;
    candidateGroups: string[];
    candidateUsers: string[];
    formKey: string;
    formId: string;
    formVersion: string | undefined;
    implementation: "JOB_WORKER" | "ZEEBE_USER_TASK";
    variables: import("@camunda8/sdk/dist/tasklist/lib/TasklistDto.js").VariableSearchResponseWithoutDraft[];
}[]>;
declare function getTasklistTaskDetails(taskId: string): Promise<TaskDetails>;
declare function assignTask(taskId: string, assignee: string): Promise<{
    id: string;
    assignee: string;
    taskState: string;
}>;
declare function completeTask(taskId: string, variables?: TaskVariables): Promise<{
    id: string;
    taskState: string;
    variables: TaskVariables;
}>;
export { listTasklistTasks, getTasklistTaskDetails, assignTask, completeTask };
//# sourceMappingURL=tasklist.service.d.ts.map