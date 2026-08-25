import { Router, type IRouter } from "express";
import { getPortfolio, addMonitoredApp } from "../lib/analytics/index.ts";

const router: IRouter = Router();

router.get("/apps", async (_req, res) => {
  res.json(await getPortfolio());
});

/** Register a new app to monitor (persisted in memory until server restart). */
router.post("/apps", (req, res) => {
  const body = req.body as {
    name?: string;
    packageName?: string;
    packageId?: string;
    gaPropertyId?: string;
    propertyId?: string;
    color?: string;
    category?: string;
  };
  const name = (body.name || "").trim();
  const packageName = (body.packageId || body.packageName || "").trim();
  const gaPropertyId = (body.propertyId || body.gaPropertyId || "").trim();

  if (!name || !packageName) {
    res.status(400).json({ error: "name and packageName are required" });
    return;
  }
  if (!gaPropertyId) {
    res.status(400).json({ error: "gaPropertyId (GA4 property id) is required for live data" });
    return;
  }

  const app = addMonitoredApp({
    name,
    packageName,
    gaPropertyId,
    color: body.color,
    category: body.category,
  });
  res.status(201).json(app);
});

export default router;