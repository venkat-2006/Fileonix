import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import uploadRoutes from "./routes/upload.routes.js";
import jobRoutes from "./routes/job.routes.js";
import healthRouter from "./routes/health.routes.js";
import testRoutes from "./routes/test.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

/* ---------------- TRUST PROXY ---------------- */

app.set("trust proxy", 1);

/* ---------------- SECURITY ---------------- */

app.use(helmet());

app.use(cors({
  origin: "*", // later restrict to frontend
}));

/* ---------------- BODY PARSER ---------------- */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- GLOBAL RATE LIMIT ---------------- */

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Try again later."
  }
});

app.use("/api", globalLimiter);

/* ---------------- UPLOAD RATE LIMIT ---------------- */

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Upload rate limit exceeded."
  }
});

app.use("/api/upload", uploadLimiter);

/* ---------------- OCR LIMIT ---------------- */

const ocrLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "OCR rate limit exceeded."
  }
});

app.use("/api/upload", (req, res, next) => {

  const OCR_TYPES = [
    "pdf->ocr",
    "image->txt",
    "image->searchable-pdf",
    "pdf->searchable-pdf"
  ];

  if (req.body && OCR_TYPES.includes(req.body.conversionType)) {
    return ocrLimiter(req, res, next);
  }

  next();
});

/* ---------------- ROUTES ---------------- */

app.use("/health", healthRouter);
app.use("/api/upload", uploadRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api", testRoutes);
app.use("/api", userRoutes);

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {

  console.error("Error:", err.message);

  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message
  });

});

export default app;