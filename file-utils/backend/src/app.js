import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

//  Trust proxy (IMPORTANT if deploying behind proxy)
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------------- GLOBAL RATE LIMIT ----------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

app.use(globalLimiter);

// ---------------- UPLOAD RATE LIMIT ----------------
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 uploads per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Upload rate limit exceeded. Try again later."
  }
});

app.use("/api/upload", uploadLimiter);

// ---------------- OCR SUPER LIMIT (Optional Advanced Protection) ----------------
const ocrLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10, // Max 10 OCR jobs per 10 minutes per IP
  message: {
    error: "OCR rate limit exceeded. Try again later."
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

export default app;