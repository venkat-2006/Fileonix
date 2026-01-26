export const MAX_FILE_SIZE_MB = 20;
export const TEMP_FILE_LIFETIME_HOURS = 2;

export const SUPPORTED_CONVERSIONS = {
  "image->pdf": ["jpg", "jpeg", "png"],
  "image->docx": ["jpg", "jpeg", "png"],
  "image->pptx": ["jpg", "jpeg", "png"],
  "image->txt": ["jpg", "jpeg", "png"],
  "pdf->images": ["pdf"],
  "txt->pdf": ["txt"],
  "pdf-merge": ["pdf"],
  "pdf-split": ["pdf"]
};

export const JOB_STATES = [
  "uploaded",
  "queued",
  "processing",
  "completed",
  "failed",
  "expired"
];
