# Backend API Documentation

## 1. Overview

This document describes the currently available HTTP APIs in the backend service.

- Runtime: Node.js + Express
- Base URL (local): `http://localhost:3000`
- Content type: `application/json`
- API prefix: `/api`

Current modules documented:
- Health endpoint
- Process Instances endpoints
- Optimize endpoints (dashboard IDs, report IDs, dashboard definition export)

## 2. How to Run the API

From the backend folder:

```bash
npm install
npm run dev
```

The server starts on:

```text
http://localhost:3000
```

Port can be overridden with environment variable:

```text
PORT=4000
```

## 3. Standard API Response Contract

All successful and failed responses are wrapped in a static structure.

### 3.1 Success Response

```json
{
  "success": true,
  "message": "string",
  "data": {}
}
```

Rules:
- `success` is always `true`
- `message` is always present
- `data` is optional and included only when provided

### 3.2 Error Response

```json
{
  "success": false,
  "message": "string",
  "error": {}
}
```

Rules:
- `success` is always `false`
- `message` is always present
- `error` includes details for troubleshooting/validation

## 4. Authentication

No auth middleware is currently applied in this service.

- No bearer token required
- No API key required

If auth is added later, this section should be updated first.

## 5. Endpoints

---

## 5.1 Health Check

### Endpoint

- Method: `GET`
- Path: `/health`

### Description

Simple liveness endpoint used by local checks, load balancers, and monitoring tools.

### Request

- Query params: none
- Path params: none
- Body: none

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Health check passed",
  "data": {
    "status": "ok"
  }
}
```

### Error Responses

Usually none unless server is down.

---

## 5.2 List Process Instances

### Endpoint

- Method: `GET`
- Path: `/api/process-instances`

### Description

Fetches process instances from Camunda Operate using iterative search.

Implementation notes:
- Uses sort on `key ASC`
- Uses `searchAfter` internally until no more items are returned
- Returns all fetched items in one response

### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| size | number | No | 100 | Batch size used for each Operate fetch loop |

Notes:
- If `size` is missing or invalid, service falls back to `100`
- Current API returns the full collected list, not paginated client-side

### Request Example

```http
GET /api/process-instances?size=50 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Process instances fetched successfully",
  "data": {
    "count": 2,
    "items": [
      {
        "key": "2251799813685249",
        "processDefinitionKey": "2251799813685200",
        "bpmnProcessId": "invoice",
        "processVersion": 3,
        "state": "COMPLETED",
        "startDate": "2026-04-13T12:00:01.000Z",
        "endDate": "2026-04-13T12:00:17.000Z",
        "tenantId": "<default>"
      },
      {
        "key": "2251799813685250",
        "processDefinitionKey": "2251799813685200",
        "bpmnProcessId": "invoice",
        "processVersion": 3,
        "state": "ACTIVE",
        "startDate": "2026-04-14T08:20:15.000Z",
        "endDate": null,
        "tenantId": "<default>"
      }
    ]
  }
}
```

### Error Response

- Status: `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Failed to reach Operate API",
  "error": {
    "name": "RequestError",
    "code": "ECONNREFUSED"
  }
}
```

---

## 5.3 Get Process Instance Details

### Endpoint

- Method: `GET`
- Path: `/api/process-instances/:instanceKey`

### Description

Returns detailed information for a single process instance.

The response aggregates:
- Main process instance (`operate.getProcessInstance`)
- Flow nodes (`operate.searchFlownodeInstances`)
- Variables (`operate.getVariablesforProcess`), with `value` parsed to JSON when possible

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| instanceKey | string | Yes | Camunda process instance key |

### Request Example

```http
GET /api/process-instances/2251799813685249 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Process instance details fetched successfully",
  "data": {
    "instance": {
      "key": "2251799813685249",
      "bpmnProcessId": "invoice",
      "processVersion": 3,
      "state": "COMPLETED"
    },
    "flowNodes": [
      {
        "key": "2251799813685301",
        "type": "START_EVENT",
        "state": "COMPLETED"
      },
      {
        "key": "2251799813685302",
        "type": "SERVICE_TASK",
        "state": "COMPLETED"
      }
    ],
    "variables": [
      {
        "name": "invoiceId",
        "value": "INV-10001"
      },
      {
        "name": "amount",
        "value": 150
      },
      {
        "name": "agentContext",
        "value": {
          "state": "READY",
          "metrics": {
            "modelCalls": 2,
            "tokenUsage": {
              "inputTokenCount": 10680,
              "outputTokenCount": 716
            }
          }
        }
      },
      {
        "name": "adHocSubProcessElements",
        "value": [
          {
            "elementId": "Query_knowledge_base",
            "elementName": "Query knowledge base"
          }
        ]
      }
    }
  }
}
```

### Validation Error Response

- Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "instanceKey": "instanceKey is required"
  }
}
```

### Server Error Response

- Status: `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Unexpected server error",
  "error": {
    "name": "Error"
  }
}
```

---

## 5.4 Get Optimize Dashboard IDs

### Endpoint

- Method: `GET`
- Path: `/api/optimize/dashboard-ids`

### Description

Retrieves all Optimize dashboard IDs for a given collection.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| collectionId | string | Yes | Optimize collection ID |

### Request Example

```http
GET /api/optimize/dashboard-ids?collectionId=40cb3657-bdcb-459d-93ce-06877ac7244a HTTP/1.1
Host: localhost:3000
Accept: application/json
```

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Optimize dashboard IDs fetched successfully",
  "data": {
    "dashboardIds": ["8a7103a7-c086-48f8-b5b7-a7f83e864688"]
  }
}
```

### Validation Error Response

- Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "collectionId": "collectionId query param is required and must be a non-empty string"
  }
}
```

---

## 5.5 Get Optimize Report IDs

### Endpoint

- Method: `GET`
- Path: `/api/optimize/report-ids`

### Description

Retrieves all Optimize report IDs for a given collection.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| collectionId | string | Yes | Optimize collection ID |

### Request Example

```http
GET /api/optimize/report-ids?collectionId=40cb3657-bdcb-459d-93ce-06877ac7244a HTTP/1.1
Host: localhost:3000
Accept: application/json
```

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Optimize report IDs fetched successfully",
  "data": {
    "reportIds": ["e6c5aaa1-6a18-44e7-8480-d562d511ba62"]
  }
}
```

### Validation Error Response

- Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "collectionId": "collectionId query param is required and must be a non-empty string"
  }
}
```

---

## 5.6 Export Optimize Dashboard Definitions

### Endpoint

- Method: `POST`
- Path: `/api/optimize/dashboard-definitions/export`

### Description

Exports dashboard definitions (including associated reports) for one or more dashboard IDs.

### Request Body

```json
{
  "dashboardIds": [
    "8a7103a7-c086-48f8-b5b7-a7f83e864688"
  ]
}
```

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Optimize dashboard definitions exported successfully",
  "data": [
    {
      "id": "8a7103a7-c086-48f8-b5b7-a7f83e864688",
      "exportEntityType": "dashboard"
    }
  ]
}
```

### Validation Error Response

- Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "dashboardIds": "dashboardIds is required and must be an array of strings"
  }
}
```

---

## 5.7 Enable Optimize Sharing

### Endpoint

- Method: `POST`
- Path: `/api/optimize/sharing/enable`

### Description

Enables Optimize sharing globally for dashboards and reports.

### Request

- Query params: none
- Path params: none
- Body: none

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Optimize sharing enabled successfully"
}
```

---

## 5.8 Disable Optimize Sharing

### Endpoint

- Method: `POST`
- Path: `/api/optimize/sharing/disable`

### Description

Disables Optimize sharing globally for dashboards and reports.

### Request

- Query params: none
- Path params: none
- Body: none

### Success Response

- Status: `200 OK`

```json
{
  "success": true,
  "message": "Optimize sharing disabled successfully"
}
```

---

## 5.9 Unknown Route (Global 404 Handler)

### Example

- Method: `GET`
- Path: `/api/does-not-exist`

### Response

- Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Route not found",
  "error": {
    "path": "/api/does-not-exist",
    "method": "GET"
  }
}
```

## 6. Data Model Notes

This project currently forwards most Camunda SDK response objects directly.

Important implications:
- Fields in `items`, `instance`, `flowNodes`, and `variables` can vary by Camunda version and data shape.
- This document shows representative payload examples, not strict exhaustive schemas.

For strict API contracts, recommended next step:
- Add DTO mapping in controller/service layer and publish explicit schemas.

## 7. cURL Examples

### 7.1 Health

```bash
curl -s http://localhost:3000/health
```

### 7.2 List process instances

```bash
curl -s "http://localhost:3000/api/process-instances?size=100"
```

### 7.3 Get process instance details

```bash
curl -s "http://localhost:3000/api/process-instances/2251799813685249"
```

### 7.4 Get Optimize dashboard IDs

```bash
curl -s "http://localhost:3000/api/optimize/dashboard-ids?collectionId=40cb3657-bdcb-459d-93ce-06877ac7244a"
```

### 7.5 Get Optimize report IDs

```bash
curl -s "http://localhost:3000/api/optimize/report-ids?collectionId=40cb3657-bdcb-459d-93ce-06877ac7244a"
```

### 7.6 Export Optimize dashboard definitions

```bash
curl -s -X POST "http://localhost:3000/api/optimize/dashboard-definitions/export" \
  -H "Content-Type: application/json" \
  -d '{"dashboardIds":["8a7103a7-c086-48f8-b5b7-a7f83e864688"]}'
```

### 7.7 Enable Optimize sharing

```bash
curl -s -X POST "http://localhost:3000/api/optimize/sharing/enable"
```

### 7.8 Disable Optimize sharing

```bash
curl -s -X POST "http://localhost:3000/api/optimize/sharing/disable"
```

## 8. OpenAPI and Swagger UI

Swagger is already integrated in this backend.

### 8.1 OpenAPI spec

- `GET /openapi.json`

### 8.2 Swagger UI

- `GET /docs/`

Use `/docs/` in a browser to explore and test APIs interactively.
