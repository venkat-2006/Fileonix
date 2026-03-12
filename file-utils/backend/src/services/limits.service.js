import {
  MAX_JOBS_PER_DAY,
  MAX_OCR_PER_DAY
} from "../utils/constants.js";

const OCR_JOB_TYPES = [
  "pdf->ocr",
  "image->txt",
  "image->searchable-pdf",
  "pdf->searchable-pdf"
];

export const enforceLimits = (stats, conversionType) => {

  const isOCR = OCR_JOB_TYPES.includes(conversionType);

  // OCR jobs have their own limit
  if (isOCR) {

    if (stats.ocr_today >= MAX_OCR_PER_DAY) {
      throw new Error("❌ Daily OCR limit reached");
    }

    return;
  }

  // Normal jobs limit
  if (stats.jobs_today >= MAX_JOBS_PER_DAY) {
    throw new Error("❌ Daily job limit reached");
  }

};