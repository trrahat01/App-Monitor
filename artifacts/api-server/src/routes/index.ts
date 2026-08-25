import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import appsRouter from "./apps.ts";
import overviewRouter from "./overview.ts";
import insightsRouter from "./insights.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appsRouter);
router.use(overviewRouter);
router.use(insightsRouter);

export default router;
