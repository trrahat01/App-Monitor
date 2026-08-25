import { Router, type IRouter } from "express";
import { getOverview, isRange } from "../lib/analytics";

const router: IRouter = Router();

router.get("/overview", async (req, res) => {
  const range = isRange(req.query.range) ? req.query.range : "30D";
  res.json(await getOverview(range));
});

export default router;