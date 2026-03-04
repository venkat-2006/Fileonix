export const MAX_FILE_SIZE_MB =
  parseInt(process.env.MAX_FILE_SIZE_MB) || 20;

export const TEMP_FILE_LIFETIME_HOURS =
  parseInt(process.env.JOB_EXPIRY_HOURS) || 2;

export const MAX_JOBS_PER_DAY =
  parseInt(process.env.MAX_JOBS_PER_DAY) || 10;

export const MAX_OCR_PER_DAY =
  parseInt(process.env.MAX_OCR_PER_DAY) || 5;

export const SUPPORTED_CONVERSIONS = {
  // ── Image Operations ──────────────────────────────
  "image->pdf":            ["jpg", "jpeg", "png"],
  "image->docx":           ["jpg", "jpeg", "png"],
  "image->pptx":           ["jpg", "jpeg", "png"],
  "image->txt":            ["jpg", "jpeg", "png"],
  "image->searchable-pdf": ["jpg", "jpeg", "png"],

  // ── Text Operations ───────────────────────────────
  "txt->pdf":              ["txt"],
  "txt->docx":             ["txt"],

  // ── PDF Operations ────────────────────────────────
  "pdf->merge":            ["pdf"],
  "pdf->split":            ["pdf"],
  "pdf->compress":         ["pdf"],
  "pdf->watermark":        ["pdf"],
  "pdf->protect":          ["pdf"],
  "pdf->unlock":           ["pdf"],
  "pdf->rotate":           ["pdf"],
  "pdf->reorder":          ["pdf"],
  "pdf->delete":           ["pdf"],
  "pdf->extract":          ["pdf"],
  "pdf->txt":              ["pdf"],
  "pdf->docx":             ["pdf"],
  "pdf->html":             ["pdf"],
  "pdf->repair":           ["pdf"],
  "pdf->grayscale":        ["pdf"],
  "pdf->flatten":          ["pdf"],
  "pdf->metadata":         ["pdf"],
  "pdf->render-images":    ["pdf"],
  "pdf->extract-images":   ["pdf"],
  "pdf->remove-blank":     ["pdf"],
  "pdf->searchable-pdf":   ["pdf"],
  "pdf->ocr":              ["pdf"],
  "pdf->keypoints":        ["pdf"],
  "pdf->keywords":         ["pdf"],
  "pdf->similarity":       ["pdf"],   // requires exactly 2 files
  // "pdf->entities":      ["pdf"],   // disabled — entity extraction

  // ── File Utilities ────────────────────────────────
  "file->expiry":          [],        // no file input required
};

export const JOB_STATES = [
  "uploaded",
  "queued",
  "processing",
  "completed",
  "failed",
  "expired"
];