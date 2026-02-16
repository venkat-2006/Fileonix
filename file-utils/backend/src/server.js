import app from "./app.js";
import "./config/env.js";
import uploadRoutes from "./routes/upload.routes.js";
import jobRoutes from "./routes/job.routes.js";
import healthRouter from "./routes/health.routes.js";
import downloadRoutes from "./routes/download.routes.js";

const PORT = process.env.PORT || 4000;

app.use("/health", healthRouter);
app.use("/api/upload", uploadRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/download", downloadRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
