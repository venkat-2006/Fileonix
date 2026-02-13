import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const worker = new Worker(
    "conversion-queue",
    async (job) => {
        const { jobId, conversionType, files } = job.data;


        console.log(`👷 Processing job ${jobId}`);
        console.log(`🔄 Type: ${conversionType}`);

        // ---------------- IMAGE → PDF ----------------
        if (conversionType === "image->pdf") {
            console.log("🖼 Image → PDF started");

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

            const outputDir = path.join("uploads", "tmp", jobId);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const outputPath = path.join(outputDir, "output.pdf");
            fs.writeFileSync(outputPath, pdfBytes);

            console.log(`✅ PDF created for job ${jobId}`);

            return { success: true, outputPath };
        }

        // ---------------- PDF MERGE ----------------
        if (conversionType === "pdf->merge") {
            console.log("📄 PDF Merge started");

            const mergedPdf = await PDFDocument.create();

            for (const file of files) {
                const pdfBytes = fs.readFileSync(file.path);
                const pdf = await PDFDocument.load(pdfBytes);

                const copiedPages = await mergedPdf.copyPages(
                    pdf,
                    pdf.getPageIndices()
                );

                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedBytes = await mergedPdf.save();

            const outputDir = path.join("uploads", "tmp", jobId);

            //  CRITICAL SAFETY FIX
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const outputPath = path.join(outputDir, "merged.pdf");

            fs.writeFileSync(outputPath, mergedBytes);

            console.log(`✅ PDF Merge done`);
            return { success: true, outputPath };
        }


        console.log("❌ Unsupported conversion");
        return { success: false };
    },
    { connection: redisConnection }
);

console.log("🚀 Conversion worker started");

