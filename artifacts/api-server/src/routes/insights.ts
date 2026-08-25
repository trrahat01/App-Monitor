import { Router, type IRouter } from "express";
import { getInsights, isRange } from "../lib/analytics/index.ts";

const router: IRouter = Router();

router.get("/insights", async (req, res) => {
  const range = isRange(req.query.range) ? req.query.range : "30D";
  res.json(await getInsights(range));
});

export default router;