import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { processInstanceRoutes } from "./routes/process-instance.routes.js";
import { optimizeRoutes } from "./routes/optimize.routes.js";
import { tasklistRoutes } from "./routes/tasklist.routes.js";
import { demoRoutes } from "./routes/demo.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { apiSuccess } from "./utils/api-response.js";
import { swaggerSpec } from "./docs/swagger.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
	return apiSuccess(res, 200, "Health check passed", { status: "ok" });
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Service health check
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 */

app.get("/openapi.json", (_req, res) => {
	res.status(200).json(swaggerSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.use("/api/process-instances", processInstanceRoutes);
app.use("/api/optimize", optimizeRoutes);
app.use("/api/tasklist", tasklistRoutes);
app.use("/api/demo", demoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);



const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
	console.log(`API server is running on port ${port}`);
});