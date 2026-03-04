import "./config/env.js";
import app from "./app.js";
import cron from "node-cron";
import { cleanupExpiredFiles } from "./services/cleanup.service.js";

const PORT = process.env.PORT || 4000;

/* ---------------- CRON CLEANUP ---------------- */

cron.schedule("*/30 * * * *", async () => {

  console.log("🧹 Running file cleanup...");

  try {
    await cleanupExpiredFiles();
  } catch (err) {
    console.error("Cleanup failed:", err.message);
  }

});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});