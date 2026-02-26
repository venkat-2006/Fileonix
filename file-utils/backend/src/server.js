import "./config/env.js";          // Load env FIRST
import app from "./app.js";

import uploadRoutes from "./routes/upload.routes.js";
import jobRoutes from "./routes/job.routes.js";
import healthRouter from "./routes/health.routes.js";
import testRoutes from "./routes/test.js";
import userRoutes from "./routes/user.routes.js"
// import repairRoutes from "./routes/repair.routes.js";
const PORT = process.env.PORT || 4000;

// Routes
app.use("/health", healthRouter);
app.use("/api/upload", uploadRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api", testRoutes);
app.use("/api", userRoutes);
// app.use("/api/repair", repairRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
