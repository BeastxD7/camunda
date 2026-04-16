-- CreateTable
CREATE TABLE "ProcessInstanceSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'camunda',
    "bpmnProcessId" TEXT NOT NULL,
    "processVersion" INTEGER,
    "state" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "tenantId" TEXT,
    "incident" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "variables" JSONB,
    "flowNodes" JSONB,
    "normalized" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessInstanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'camunda',
    "taskState" TEXT NOT NULL,
    "name" TEXT,
    "taskDefinitionId" TEXT,
    "processName" TEXT,
    "processInstanceKey" TEXT,
    "assignee" TEXT,
    "creationDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "tenantId" TEXT,
    "candidateGroups" JSONB,
    "candidateUsers" JSONB,
    "formKey" TEXT,
    "formId" TEXT,
    "formVersion" TEXT,
    "implementation" TEXT,
    "variables" JSONB,
    "taskDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizeDashboardSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'camunda',
    "collectionId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "dashboardId" TEXT NOT NULL,
    "dashboardData" JSONB NOT NULL,
    "reportsData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizeDashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizeReportSnapshot" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'camunda',
    "collectionId" TEXT NOT NULL,
    "dashboardId" TEXT,
    "reportId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizeReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessInstanceSnapshot_sourceKey_key" ON "ProcessInstanceSnapshot"("sourceKey");

-- CreateIndex
CREATE INDEX "ProcessInstanceSnapshot_bpmnProcessId_idx" ON "ProcessInstanceSnapshot"("bpmnProcessId");

-- CreateIndex
CREATE INDEX "ProcessInstanceSnapshot_state_idx" ON "ProcessInstanceSnapshot"("state");

-- CreateIndex
CREATE INDEX "ProcessInstanceSnapshot_startDate_idx" ON "ProcessInstanceSnapshot"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSnapshot_sourceKey_key" ON "TaskSnapshot"("sourceKey");

-- CreateIndex
CREATE INDEX "TaskSnapshot_taskState_idx" ON "TaskSnapshot"("taskState");

-- CreateIndex
CREATE INDEX "TaskSnapshot_assignee_idx" ON "TaskSnapshot"("assignee");

-- CreateIndex
CREATE INDEX "TaskSnapshot_processInstanceKey_idx" ON "TaskSnapshot"("processInstanceKey");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizeDashboardSnapshot_sourceKey_key" ON "OptimizeDashboardSnapshot"("sourceKey");

-- CreateIndex
CREATE INDEX "OptimizeDashboardSnapshot_collectionId_idx" ON "OptimizeDashboardSnapshot"("collectionId");

-- CreateIndex
CREATE INDEX "OptimizeDashboardSnapshot_dashboardId_idx" ON "OptimizeDashboardSnapshot"("dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizeReportSnapshot_sourceKey_key" ON "OptimizeReportSnapshot"("sourceKey");

-- CreateIndex
CREATE INDEX "OptimizeReportSnapshot_collectionId_idx" ON "OptimizeReportSnapshot"("collectionId");

-- CreateIndex
CREATE INDEX "OptimizeReportSnapshot_dashboardId_idx" ON "OptimizeReportSnapshot"("dashboardId");

-- CreateIndex
CREATE INDEX "OptimizeReportSnapshot_reportId_idx" ON "OptimizeReportSnapshot"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");
