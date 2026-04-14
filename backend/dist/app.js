import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { processInstanceRoutes } from "./routes/process-instance.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
app.use("/api/process-instances", processInstanceRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
export { app };
//# sourceMappingURL=app.js.map