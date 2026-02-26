export const enforceLimits = (stats) => {
  const MAX_JOBS_PER_DAY = 10;
  const MAX_OCR_PER_DAY = 5;

  if (stats.jobs_today >= MAX_JOBS_PER_DAY) {
    throw new Error("❌ Daily job limit reached");
  }

  if (stats.ocr_today >= MAX_OCR_PER_DAY) {
    throw new Error("❌ Daily OCR limit reached");
  }
};