import { Router, type IRouter } from "express";
import { getPortfolio } from "../lib/analytics";

const router: IRouter = Router();

router.get("/apps", async (_req, res) => {
  res.json(await getPortfolio());
});

export default router;