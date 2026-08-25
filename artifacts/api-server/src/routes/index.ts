import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appsRouter from "./apps";
import overviewRouter from "./overview";
import insightsRouter from "./insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appsRouter);
router.use(overviewRouter);
router.use(insightsRouter);

export default router;
