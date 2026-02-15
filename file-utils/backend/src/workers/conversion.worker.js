import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import { Poppler } from "node-poppler";

import PptxGenJS from "pptxgenjs";
import { Document, Packer, Paragraph, ImageRun, TextRun, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from "docx";


// Helper function to create tables (moved outside worker)
function createTableFromRows(rows) {
    const tableRows = rows.map(row => {
        const cells = row.split("::").map(cell =>
            new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: cell.trim(),
                                size: 20,
                            }),
                        ],
                    }),
                ],
                shading: {
                    fill: "F3F3F3",
                },
            })
        );

        return new TableRow({ children: cells });
    });

    return new Table({
        rows: tableRows,
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        },
    });
}


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

                const poppler = new Poppler();

                await poppler.pdfToCairo(
                    pdfFile.path,
                    path.join(outputDir, "page"),
                    { pngFile: true }
                );

                console.log("✅ PDF → Images done");

                return { success: true };

            } catch (err) {
                console.error("❌ PDF → Images FAILED:", err);
                throw err;
            }
        }

        // ---------------- IMAGE → DOCX ----------------
        if (conversionType === "image->docx") {
            console.log("📄 Image → DOCX started");

            try {
                const doc = new Document({
                    sections: [
                        {
                            children: [],
                        },
                    ],
                });

                for (const file of files) {
                    console.log("🖼 Adding image:", file.originalname);

                    const image = fs.readFileSync(file.path);

                    doc.addSection({
                        children: [
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: image,
                                        transformation: {
                                            width: 500,
                                            height: 300,
                                        },
                                    }),
                                ],
                            }),
                        ],
                    });
                }

                const buffer = await Packer.toBuffer(doc);

                const outputDir = path.join("uploads", "tmp", jobId);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "output.docx");

                fs.writeFileSync(outputPath, buffer);

                console.log("✅ Image → DOCX done");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ Image → DOCX FAILED:", err);
                throw err;
            }
        }

        // ---------------- IMAGE → PPTX ----------------
        if (conversionType === "image->pptx") {
            console.log("📊 Image → PPTX started");

            try {
                const pptx = new PptxGenJS();

                for (const file of files) {
                    console.log("🖼 Adding slide for:", file.originalname);

                    const slide = pptx.addSlide();

                    slide.addImage({
                        path: file.path,
                        x: 0.5,
                        y: 0.5,
                        w: 9,
                        h: 5,
                    });
                }

                const outputDir = path.join("uploads", "tmp", jobId);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "output.pptx");

                await pptx.writeFile({ fileName: outputPath });

                console.log("✅ Image → PPTX done");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ Image → PPTX FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → TXT ----------------
        if (conversionType === "pdf->txt") {
            console.log("🧾 PDF → TXT started");

            try {
                const poppler = new Poppler();
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "extracted.txt");

                await poppler.pdfToText(inputPdf, outputPath);

                console.log("✅ Text extracted from PDF");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF → TXT FAILED:", err);
                throw err;
            }
        }


// ---------------- PDF → DOCX (ENHANCED) ----------------
if (conversionType === "pdf->docx") {
    console.log("📄 PDF → DOCX started (Enhanced)");

    try {
        const pdfFile = files[0];
        const poppler = new Poppler();

        const outputDir = path.join("uploads", "tmp", jobId);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const tempTxtPath = path.join(outputDir, "temp.txt");

        // Extract text with layout preservation
        // Use the correct option format for node-poppler
        await poppler.pdfToText(pdfFile.path, tempTxtPath, {
            maintainLayout: true  // ⭐ Changed from 'layout' to 'maintainLayout'
        });

        const extractedText = fs.readFileSync(tempTxtPath, "utf-8");
        const lines = extractedText.split(/\r?\n/);

        const paragraphs = [];
        let inTable = false;
        let tableRows = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmedLine = line.trim();

            // Skip completely empty lines
            if (!trimmedLine) {
                if (!inTable && paragraphs.length > 0) {
                    paragraphs.push(new Paragraph({ text: "" }));
                }
                continue;
            }

            // 🎯 DETECT DOCUMENT HEADER (multi-line centered text at start)
            if (i < 5 && trimmedLine.length > 0) {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: trimmedLine,
                                bold: true,
                                size: i === 0 ? 28 : 22,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                    })
                );
                continue;
            }

            // 🎯 DETECT SECTION HEADERS (ALL CAPS, standalone)
            const isHeader =
                trimmedLine === trimmedLine.toUpperCase() &&
                trimmedLine.length < 50 &&
                !trimmedLine.includes("::") &&
                /^[A-Z\s]+$/.test(trimmedLine);

            if (isHeader) {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: trimmedLine,
                                bold: true,
                                size: 26,
                                color: "1F4788",
                            }),
                        ],
                        spacing: { before: 300, after: 200 },
                        border: {
                            bottom: {
                                color: "1F4788",
                                space: 1,
                                style: BorderStyle.SINGLE,
                                size: 6,
                            },
                        },
                    })
                );
                continue;
            }

            // 🎯 DETECT KEY-VALUE PAIRS with "::"
            if (trimmedLine.includes("::")) {
                const parts = trimmedLine.split("::");
                if (parts.length === 2) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: parts[0].trim() + ": ",
                                    bold: true,
                                    size: 22,
                                }),
                                new TextRun({
                                    text: parts[1].trim(),
                                    size: 22,
                                }),
                            ],
                            spacing: { after: 120 },
                        })
                    );
                    continue;
                }
            }

            // 🎯 DETECT TABLE-LIKE CONTENT (multiple "::" or aligned content)
            const hasMultipleColons = (trimmedLine.match(/::/g) || []).length >= 2;
            if (hasMultipleColons) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(trimmedLine);
                continue;
            } else if (inTable) {
                // End of table - create table in DOCX
                paragraphs.push(createTableFromRows(tableRows));
                inTable = false;
                tableRows = [];
            }

            // 🎯 NORMAL TEXT
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: trimmedLine,
                            size: 22,
                        }),
                    ],
                    spacing: { after: 120 },
                })
            );
        }

        // Handle any remaining table
        if (tableRows.length > 0) {
            paragraphs.push(createTableFromRows(tableRows));
        }

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: 1440,    // 1 inch
                                right: 1440,
                                bottom: 1440,
                                left: 1440,
                            },
                        },
                    },
                    children: paragraphs,
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);
        const outputPath = path.join(outputDir, "output.docx");
        fs.writeFileSync(outputPath, buffer);

        console.log("✅ DOCX created from PDF (Enhanced)");
        return { success: true, outputPath };

    } catch (err) {
        console.error("❌ PDF → DOCX FAILED:", err);
        throw err;
    }
}
        // ---------------- TXT → DOCX ----------------
        if (conversionType === "txt->docx") {
            console.log("📝 TXT → DOCX started");

            try {
                const inputTxt = files[0].path;
                const textContent = fs.readFileSync(inputTxt, "utf-8");

                // ✅ Split text into lines
                const lines = textContent.split(/\r?\n/);

                const paragraphs = lines.map(line =>
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: 24,          // 12pt (Word uses half-points)
                                font: "Calibri",
                            }),
                        ],
                        spacing: {
                            after: 200,           // spacing after paragraph
                        },
                    })
                );

                const doc = new Document({
                    sections: [
                        {
                            children: paragraphs,
                        },
                    ],
                });

                const buffer = await Packer.toBuffer(doc);

                const outputDir = path.join("uploads", "tmp", jobId);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "output.docx");

                fs.writeFileSync(outputPath, buffer);

                console.log("✅ DOCX created from TXT");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ TXT → DOCX FAILED:", err);
                throw err;
            }
        }


        console.log("❌ Unsupported conversion");
        return { success: false };
    },
    { connection: redisConnection }
);

console.log("🚀 Conversion worker started");

