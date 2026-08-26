import { Router, type IRouter } from "express";
import { getPortfolio, addMonitoredApp } from "../lib/analytics/index.ts";
import { recordTesters, computeStreak, seedStreak } from "../lib/analytics/closedTesting.ts";

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

/** Record today's tester count for an app (drives the streak/progress). */
router.post("/apps/:appId/testers", (req, res) => {
  const { appId } = req.params;
  const body = req.body as { testers?: number; date?: string };
  const testers = Number(body.testers);
  if (!Number.isFinite(testers) || testers < 0) {
    res.status(400).json({ error: "testers must be a non-negative number" });
    return;
  }
  recordTesters(appId, Math.floor(testers), body.date);
  res.json({ ok: true, appId });
});

/** Get the streak for one app, given its current reported tester count. */
router.get("/apps/:appId/streak", (req, res) => {
  const { appId } = req.params;
  const live = Number(req.query.testers) || 0;
  res.json(computeStreak(appId, live));
});

/**
 * Seed the current closed-testing streak from your real Play Console state.
 * Body: { testers, daysAt12Plus, date? } — marks the last `daysAt12Plus` days
 * (ending today or `date`) as having >=12 testers. This lets the app reflect
 * what Play Console reports (e.g. 12 testers, 10 consecutive days) without
 * waiting for daily manual entries.
 */
router.post("/apps/:appId/seed", (req, res) => {
  const { appId } = req.params;
  const body = req.body as { testers?: number; daysAt12Plus?: number; date?: string };
  const testers = Number(body.testers);
  const days = Number(body.daysAt12Plus);
  if (!Number.isFinite(testers) || testers < 0 || !Number.isFinite(days) || days < 0 || days > 30) {
    res.status(400).json({ error: "testers and daysAt12Plus (0-30) are required" });
    return;
  }
  seedStreak(appId, Math.floor(testers), Math.floor(days), body.date);
  res.json(computeStreak(appId, Math.floor(testers)));
});

export default router;