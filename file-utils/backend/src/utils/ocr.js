import tesseract from "node-tesseract-ocr";

/**
 * Extract text from image using OCR
 * @param {string} imagePath
 * @param {string} language (eng, hin, spa, etc.)
 */
export async function extractTextFromImage(imagePath, language = "eng") {
  try {
    const config = {
      lang: language,      //  dynamic language
      oem: 1,              // LSTM OCR Engine
      psm: 3,              // Fully automatic page segmentation
      dpi: 300,            //  QUALITY BOOST (important)
    };

    const text = await tesseract.recognize(imagePath, config);
    return text;

  } catch (err) {
    console.error("❌ OCR Error:", err);
    throw err;
  }
}
