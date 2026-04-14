import "dotenv/config";
import { Camunda8 } from "@camunda8/sdk";
declare const camundaClient: Camunda8;
declare const operateClient: import("@camunda8/sdk/dist/operate/index.js").OperateApiClient;
declare const optimizeClient: import("@camunda8/sdk/dist/optimize/index.js").OptimizeApiClient;
declare const tasklistClient: import("@camunda8/sdk/dist/tasklist/index.js").TasklistApiClient;
declare const orchestrationClient: any;
export { camundaClient, operateClient, optimizeClient, orchestrationClient, tasklistClient };
//# sourceMappingURL=camunda.client.d.ts.map