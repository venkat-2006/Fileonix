import app from "./app.js";
import "./config/env.js";
import healthRouter from "./routes/health.routes.js";

const PORT = process.env.PORT || 4000;

app.use("/health", healthRouter);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
