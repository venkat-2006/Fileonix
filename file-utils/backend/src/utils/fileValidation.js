import path from "path";
import { SUPPORTED_CONVERSIONS } from "./constants.js";

export function validateFiles(files, conversionType) {
  if (!SUPPORTED_CONVERSIONS[conversionType]) {
    throw new Error("Unsupported conversion type");
  }

  const allowedExts = SUPPORTED_CONVERSIONS[conversionType];

  for (const file of files) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw new Error(`File type .${ext} not allowed for ${conversionType}`);
    }
  }
}
