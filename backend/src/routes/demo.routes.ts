import { Router } from "express";
import {
	getDemoSourceModeController,
	setDemoSourceModeController,
	syncDemoDataController,
} from "../controllers/demo.controller.js";

const demoRoutes = Router();

demoRoutes.get("/source", getDemoSourceModeController);
demoRoutes.post("/source", setDemoSourceModeController);
demoRoutes.post("/sync", syncDemoDataController);

export { demoRoutes };