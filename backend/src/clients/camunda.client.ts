import "dotenv/config";
import { Camunda8 } from "@camunda8/sdk";

const camundaClient = new Camunda8();
const operateClient = camundaClient.getOperateApiClient();
const optimizeClient = camundaClient.getOptimizeApiClient();
const tasklistClient = camundaClient.getTasklistApiClient();
const orchestrationClient: any = camundaClient.getOrchestrationClusterApiClientLoose();

export { camundaClient, operateClient, optimizeClient, orchestrationClient, tasklistClient };