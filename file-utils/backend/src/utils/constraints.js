export const MAX_FILE_SIZE_MB = 20;

export const TEMP_FILE_LIFETIME_HOURS = 2;

export const SUPPORTED_CONVERSIONS = {
  "image->pdf": {
    input: ["jpg", "jpeg", "png"],
    output: "pdf"
  },
  "image->docx": {
    input: ["jpg", "jpeg", "png"],
    output: "docx"
  },
  "image->pptx": {
    input: ["jpg", "jpeg", "png"],
    output: "pptx"
  },
  "image->txt": {
    input: ["jpg", "jpeg", "png"],
    output: "txt"
  },
  "pdf->images": {
    input: ["pdf"],
    output: "zip"
  },
  "txt->pdf": {
    input: ["txt"],
    output: "pdf"
  },
  "pdf-merge": {
    input: ["pdf"],
    output: "pdf"
  },
  "pdf-split": {
    input: ["pdf"],
    output: "zip"
  }
};
