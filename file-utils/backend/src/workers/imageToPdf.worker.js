import { Worker } from "bullmq";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import { redisConnection } from "../config/redis.js";

const worker = new Worker(
  "conversionQueue",
  async (job) => {
    const { jobId, files } = job.data;

    console.log(`🖼 Converting images → PDF | Job ${jobId}`);

    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      const imageBytes = fs.readFileSync(file.path);

      let image;
      if (file.mimetype === "image/png") {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    const pdfBytes = await pdfDoc.save();

    const outputDir = `uploads/tmp/${jobId}`;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, "output.pdf");
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`✅ PDF created for Job ${jobId}`);
  },
  { connection: redisConnection }
);

console.log("🚀 Image → PDF worker started");
