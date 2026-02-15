import tesseract from "node-tesseract-ocr";

const config = {
  lang: "eng",
  oem: 1,
  psm: 3,
};

export async function extractTextFromImage(imagePath) {
  try {
    const text = await tesseract.recognize(imagePath, config);
    return text;
  } catch (err) {
    console.error("OCR Error:", err);
    throw err;
  }
}
