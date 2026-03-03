const OCR_JOB_TYPES = [
  "pdf->ocr",
  "image->txt",
  "image->searchable-pdf",
  "pdf->searchable-pdf"
];

export const enforceLimits = (stats, conversionType) => {
  const MAX_JOBS_PER_DAY = 10;
  const MAX_OCR_PER_DAY = 5;

  if (stats.jobs_today >= MAX_JOBS_PER_DAY) {
    throw new Error("❌ Daily job limit reached");
  }

  if (
    OCR_JOB_TYPES.includes(conversionType) &&
    stats.ocr_today >= MAX_OCR_PER_DAY
  ) {
    throw new Error("❌ Daily OCR limit reached");
  }
};