import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import poppler from "pdf-poppler";

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

        // ---------------- PDF SPLIT ----------------
        if (conversionType === "pdf->split") {
            console.log("✂️ PDF Split started");

            try {
                const srcPdfBytes = fs.readFileSync(files[0].path);
                const srcPdf = await PDFDocument.load(srcPdfBytes);

                const totalPages = srcPdf.getPageCount();
                console.log(`📄 Total pages: ${totalPages}`);

                const outputDir = path.join("uploads", "tmp", jobId);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                for (let i = 0; i < totalPages; i++) {
                    const newPdf = await PDFDocument.create();

                    const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
                    newPdf.addPage(copiedPage);

                    const pdfBytes = await newPdf.save();

                    const outputPath = path.join(outputDir, `page-${i + 1}.pdf`);
                    fs.writeFileSync(outputPath, pdfBytes);

                    console.log(`✅ Created page-${i + 1}.pdf`);
                }

                console.log("✅ PDF Split done");
                return { success: true };

            } catch (err) {
                console.error("❌ PDF Split FAILED:", err);
                throw err;
            }
        }

        // ---------------- TXT → PDF ----------------
        if (conversionType === "txt->pdf") {
            console.log("📝 TXT → PDF started");

            try {
                const txtFile = files[0];

                const text = fs.readFileSync(txtFile.path, "utf-8");

                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage();

                page.drawText(text, {
                    x: 50,
                    y: page.getHeight() - 50,
                    size: 12,
                    maxWidth: page.getWidth() - 100,
                    lineHeight: 14,
                });

                const pdfBytes = await pdfDoc.save();

                const outputDir = path.join("uploads", "tmp", jobId);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "text.pdf");
                fs.writeFileSync(outputPath, pdfBytes);

                console.log("✅ TXT → PDF done");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ TXT → PDF FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF → IMAGES ----------------
        if (conversionType === "pdf->images") {
            console.log("🖼 PDF → Images started");

            try {
                const pdfFile = files[0];

                const outputDir = path.join("uploads", "tmp", jobId, "images");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const options = {
                    format: "png",
                    out_dir: outputDir,
                    out_prefix: "page",
                    page: null,
                };

                await poppler.convert(pdfFile.path, options);

                console.log("✅ PDF → Images done");

                return { success: true };

            } catch (err) {
                console.error("❌ PDF → Images FAILED:", err);
                throw err;
            }
        }


        console.log("❌ Unsupported conversion");
        return { success: false };
    },
    { connection: redisConnection }
);

console.log("🚀 Conversion worker started");

