import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJSDoc from "swagger-jsdoc";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerOptions = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Camunda Support Backend API",
            version: "1.0.0",
            description: "Express APIs for Camunda process instance operations",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local development server",
            },
        ],
        components: {
            schemas: {
                ApiSuccess: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Request successful" },
                        data: { type: "object", additionalProperties: true },
                    },
                    required: ["success", "message"],
                },
                ApiError: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Unexpected server error" },
                        error: { type: "object", additionalProperties: true },
                    },
                    required: ["success", "message", "error"],
                },
            },
        },
    },
    apis: [
        path.resolve(__dirname, "../index.ts"),
        path.resolve(__dirname, "../routes/**/*.ts"),
        path.resolve(__dirname, "../index.js"),
        path.resolve(__dirname, "../routes/**/*.js"),
    ],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
export { swaggerSpec };
//# sourceMappingURL=swagger.js.map