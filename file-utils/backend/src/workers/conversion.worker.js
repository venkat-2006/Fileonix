import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import fs from "../utils/fsSafe.js";
import path from "path";
import { Poppler } from "node-poppler";
import { PDFDocument, degrees } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import { Document, Packer, Paragraph, ImageRun, TextRun, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from "docx";
import { exec } from "child_process";
import { extractTextFromImage } from "../utils/ocr.js";
import { supabase } from "../config/supabase.js";

import winkNLP from "wink-nlp";
import winkModel from "wink-eng-lite-web-model";
import keywordExtractor from "keyword-extractor";
import compromise from "compromise";


const nlp = winkNLP(winkModel);
function cosineSimilarity(textA, textB) {

    const tokenize = (text) =>
        text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];

    const freqMap = (tokens) => {
        const map = {};
        tokens.forEach(t => map[t] = (map[t] || 0) + 1);
        return map;
    };

    const tokensA = tokenize(textA);
    const tokensB = tokenize(textB);

    const freqA = freqMap(tokensA);
    const freqB = freqMap(tokensB);

    const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);

    let dot = 0, magA = 0, magB = 0;

    for (const word of allWords) {
        const a = freqA[word] || 0;
        const b = freqB[word] || 0;

        dot += a * b;
        magA += a * a;
        magB += b * b;
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;

    return dot / (magA * magB);
}



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

            const outputDir = path.join("uploads", "tmp", jobId, "output");
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

            const outputDir = path.join("uploads", "tmp", jobId, "output");

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

                const outputDir = path.join("uploads", "tmp", jobId, "output");

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

                const outputDir = path.join("uploads", "tmp", jobId, "output");

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

                const outputDir = path.join("uploads", "tmp", jobId, "output");

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

                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "output.pptx");

                await pptx.writeFile({ fileName: outputPath });

                console.log("✅ Image → PPTX done");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ Image → pdf->pptX FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → TXT ----------------
        if (conversionType === "pdf->txt") {
            console.log("🧾 PDF → TXT started");

            try {
                const poppler = new Poppler();
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output");

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

                const outputDir = path.join("uploads", "tmp", jobId, "output");
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

                const outputDir = path.join("uploads", "tmp", jobId, "output");
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

        // ---------------- PDF COMPRESSION (BEST) ----------------
        if (conversionType === "pdf->compress") {
            console.log("🗜️ PDF Compression started");

            try {
                const inputPdf = files[0].path;
                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const originalSize = fs.statSync(inputPdf).size;
                console.log(`📊 Original size: ${(originalSize / 1024).toFixed(0)} KB`);

                // 🎯 STRATEGY 1: Try /screen quality (most aggressive)
                const screenPath = path.join(outputDir, "compressed_screen.pdf");
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${screenPath}" "${inputPdf}"`,
                        (error) => error ? reject(error) : resolve()
                    );
                });
                const screenSize = fs.statSync(screenPath).size;

                // 🎯 STRATEGY 2: Try /ebook quality (balanced)
                const ebookPath = path.join(outputDir, "compressed_ebook.pdf");
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${ebookPath}" "${inputPdf}"`,
                        (error) => error ? reject(error) : resolve()
                    );
                });
                const ebookSize = fs.statSync(ebookPath).size;

                // 🎯 STRATEGY 3: Try /printer quality (high quality)
                const printerPath = path.join(outputDir, "compressed_printer.pdf");
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/printer -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${printerPath}" "${inputPdf}"`,
                        (error) => error ? reject(error) : resolve()
                    );
                });
                const printerSize = fs.statSync(printerPath).size;

                console.log(`📉 /screen: ${(screenSize / 1024).toFixed(0)} KB | /ebook: ${(ebookSize / 1024).toFixed(0)} KB | /printer: ${(printerSize / 1024).toFixed(0)} KB`);

                // 🧠 Pick the smallest file that's smaller than original
                const options = [
                    { path: screenPath, size: screenSize, quality: "screen" },
                    { path: ebookPath, size: ebookSize, quality: "ebook" },
                    { path: printerPath, size: printerSize, quality: "printer" },
                ].filter(opt => opt.size < originalSize).sort((a, b) => a.size - b.size);

                const finalOutputPath = path.join(outputDir, "compressed.pdf");

                if (options.length > 0) {
                    const best = options[0];
                    fs.copyFileSync(best.path, finalOutputPath);

                    // Cleanup
                    [screenPath, ebookPath, printerPath].forEach(p => {
                        if (fs.existsSync(p)) fs.unlinkSync(p);
                    });

                    const reduction = ((1 - best.size / originalSize) * 100).toFixed(1);
                    console.log(`✅ Best: /${best.quality} | ${(originalSize / 1024).toFixed(0)} KB → ${(best.size / 1024).toFixed(0)} KB (${reduction}% reduction)`);

                    return { success: true, outputPath: finalOutputPath };
                } else {
                    // Return original
                    fs.copyFileSync(inputPdf, finalOutputPath);
                    [screenPath, ebookPath, printerPath].forEach(p => {
                        if (fs.existsSync(p)) fs.unlinkSync(p);
                    });

                    console.log(`⚠️ No compression possible - returning original`);
                    return { success: true, outputPath: finalOutputPath };
                }

            } catch (err) {
                console.error("❌ PDF Compression FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF WATERMARK ----------------
        if (conversionType === "pdf->watermark") {
            console.log("💧 PDF Watermark started");

            try {
                const inputPdf = files[0].path;
                const { watermarkText } = job.data;
                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pages = pdfDoc.getPages();
                const text = watermarkText || "WATERMARK";

                // Apply watermark to each page
                pages.forEach(page => {
                    const { width, height } = page.getSize();

                    //  Dynamic font size based on page width
                    const fontSize = Math.min(width / text.length * 0.8, 100);

                    //  Approximate text width
                    const textWidth = text.length * fontSize * 0.6;

                    // TRUE CENTER positioning for 45° rotation
                    // When rotated 45°, we need to offset both x and y
                    const centerX = width / 2;
                    const centerY = height / 2;

                    // Offset to account for rotation pivot point
                    const offsetX = textWidth / 2 * Math.cos(Math.PI / 4);
                    const offsetY = textWidth / 2 * Math.sin(Math.PI / 4);

                    page.drawText(text, {
                        x: centerX - offsetX,
                        y: centerY - offsetY,
                        size: fontSize,
                        opacity: 0.15,
                        rotate: { type: 'degrees', angle: 45 }
                    });
                });

                const watermarkedBytes = await pdfDoc.save();
                const outputPath = path.join(outputDir, "watermarked.pdf");
                fs.writeFileSync(outputPath, watermarkedBytes);

                console.log(`✅ Watermark applied: "${text}"`);

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Watermark FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF PASSWORD PROTECT ----------------
        if (conversionType === "pdf->protect") {
            console.log("🔐 PDF Protection started");

            try {
                const inputPdf = files[0].path;
                const { password } = job.data;

                if (!password) {
                    throw new Error("❌ Password is required for protection");
                }

                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "protected.pdf");

                // ✅ Use Ghostscript for password protection
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sOwnerPassword="${password}" -sUserPassword="${password}" -dEncryptionR=3 -dKeyLength=128 -dPermissions=-44 -sOutputFile="${outputPath}" "${inputPdf}"`,
                        (error, stdout, stderr) => {
                            if (error) {
                                console.error("❌ Protection failed:", error);
                                console.error("stderr:", stderr);
                                reject(error);
                            } else {
                                console.log("📊 Ghostscript output:", stdout);
                                resolve();
                            }
                        }
                    );
                });

                console.log(`✅ PDF Protected with password`);

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Protection FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF REMOVE PASSWORD ----------------
        if (conversionType === "pdf->unlock") {
            console.log("🔓 PDF Unlock started");

            try {
                const inputPdf = files[0].path;
                const { password } = job.data;

                if (!password) {
                    throw new Error("❌ Password required to unlock PDF");
                }

                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "unlocked.pdf");

                // ✅ Use Ghostscript to remove password
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sPDFPassword="${password}" -sOutputFile="${outputPath}" "${inputPdf}"`,
                        (error, stdout, stderr) => {
                            if (error) {
                                console.error("❌ Unlock failed:", error);
                                console.error("stderr:", stderr);
                                reject(error);
                            } else {
                                console.log("📊 Ghostscript output:", stdout);
                                resolve();
                            }
                        }
                    );
                });

                console.log("✅ PDF Unlocked");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Unlock FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF ROTATE ----------------
        if (conversionType === "pdf->rotate") {
            console.log("🔄 PDF Rotate started");

            try {
                const inputPdf = files[0].path;
                const { angle } = job.data;

                const rotation = parseInt(angle) || 90;

                // Validate rotation angle
                if (![90, 180, 270, -90].includes(rotation)) {
                    throw new Error("❌ Invalid rotation angle. Use 90, 180, or 270");
                }

                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const pages = pdfDoc.getPages();

                // Rotate all pages
                pages.forEach(page => {
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(degrees(currentRotation + rotation));
                });

                const rotatedBytes = await pdfDoc.save();

                const outputPath = path.join(outputDir, "rotated.pdf");
                fs.writeFileSync(outputPath, rotatedBytes);

                console.log(`✅ PDF Rotated by ${rotation}°`);

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Rotate FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF REORDER ----------------
        if (conversionType === "pdf->reorder") {
            console.log("📑 PDF Reorder started");

            try {
                if (!files || files.length === 0) {
                    throw new Error("No PDF file provided");
                }

                const inputPdf = files[0].path;
                const { order } = job.data;

                if (!order || order.trim() === "") {
                    throw new Error("Page order is required");
                }

                // Ensure outputDir exists (same as rotate)
                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Convert order → array
                const orderArray = order.split(",")
                    .map(n => n.trim())
                    .filter(n => n !== "")
                    .map(n => {
                        const pageNum = parseInt(n, 10);

                        if (isNaN(pageNum)) {
                            throw new Error(`Invalid page value: "${n}"`);
                        }

                        return pageNum - 1; // zero-based index
                    });

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const totalPages = pdfDoc.getPageCount();

                // Validate pages
                orderArray.forEach(p => {
                    if (p < 0 || p >= totalPages) {
                        throw new Error(`Invalid page number: ${p + 1}`);
                    }
                });

                const newPdf = await PDFDocument.create();

                const pages = await newPdf.copyPages(pdfDoc, orderArray);
                pages.forEach(page => newPdf.addPage(page));

                const reorderedBytes = await newPdf.save();

                const outputPath = path.join(outputDir, "reordered.pdf");
                fs.writeFileSync(outputPath, reorderedBytes);

                console.log("✅ PDF Reordered Successfully");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Reorder FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF DELETE PAGES ----------------
        if (conversionType === "pdf->delete") {
            console.log("🗑 PDF Delete Pages started");

            try {
                if (!files || files.length === 0) {
                    throw new Error("No PDF file provided");
                }

                const inputPdf = files[0].path;
                const { pages } = job.data;

                if (!pages || pages.trim() === "") {
                    throw new Error("Pages parameter required (e.g. 2,5,7)");
                }

                // Ensure outputDir exists
                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Convert pages string → zero-based indices
                const removePages = pages.split(",")
                    .map(n => n.trim())
                    .filter(n => n !== "")
                    .map(n => {
                        const pageNum = parseInt(n, 10);

                        if (isNaN(pageNum)) {
                            throw new Error(`Invalid page value: "${n}"`);
                        }

                        return pageNum - 1;
                    });

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const totalPages = pdfDoc.getPageCount();

                // Validate page numbers
                removePages.forEach(p => {
                    if (p < 0 || p >= totalPages) {
                        throw new Error(`Invalid page number: ${p + 1}`);
                    }
                });

                // Remove duplicates (important)
                const removeSet = new Set(removePages);

                const keepPages = [];
                for (let i = 0; i < totalPages; i++) {
                    if (!removeSet.has(i)) {
                        keepPages.push(i);
                    }
                }

                if (keepPages.length === 0) {
                    throw new Error("Cannot delete all pages");
                }

                const newPdf = await PDFDocument.create();

                const copiedPages = await newPdf.copyPages(pdfDoc, keepPages);
                copiedPages.forEach(page => newPdf.addPage(page));

                const outputBytes = await newPdf.save();

                const outputPath = path.join(outputDir, "pages-deleted.pdf");
                fs.writeFileSync(outputPath, outputBytes);

                console.log("✅ Pages deleted successfully");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Delete FAILED:", err);
                throw err;
            }
        }
        if (conversionType === "image->txt") {
            console.log("🔍 OCR Image → TXT started");

            try {
                const { language } = job.data;
                const lang = language || "eng";

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                fs.mkdirSync(outputDir, { recursive: true });

                let finalText = "";

                for (const file of files) {
                    console.log(`🔍 OCR: ${file.originalname} (${lang})`);

                    const text = await extractTextFromImage(file.path, lang);

                    finalText += `\n--- ${file.originalname} ---\n`;
                    finalText += text;
                }

                const outputPath = path.join(outputDir, "ocr.txt");
                fs.writeFileSync(outputPath, finalText);

                console.log(`✅ OCR extraction done (${lang})`);

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ Image → TXT FAILED:", err);
                throw err;
            }
        }

        if (conversionType === "pdf->ocr") {
            console.log("🔍 OCR PDF → TXT started");

            try {
                const { language } = job.data;
                const lang = language || "eng";

                const poppler = new Poppler();
                const outputDir = path.join("uploads", "tmp", jobId, "output");
                const imagesDir = path.join(outputDir, "ocr-pages");

                fs.mkdirSync(imagesDir, { recursive: true });

                const pdfPath = files[0].path;

                // ✅ SAFE Poppler conversion (version-proof)
                await poppler.pdfToCairo(
                    pdfPath,
                    path.join(imagesDir, "page"),
                    {
                        pngFile: true
                    }
                );

                const images = fs.readdirSync(imagesDir).sort();

                let finalText = "";

                for (const img of images) {
                    const imgPath = path.join(imagesDir, img);

                    console.log(`🔍 OCR: ${img} (${lang})`);

                    // ✅ OCR with DPI boost
                    const text = await extractTextFromImage(imgPath, lang);

                    finalText += `\n--- ${img} ---\n`;
                    finalText += text;
                }

                const outputPath = path.join(outputDir, "ocr.txt");
                fs.writeFileSync(outputPath, finalText);

                console.log(`✅ OCR PDF done (${lang})`);

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF → OCR FAILED:", err);
                throw err;
            }
        }

        // ---------------- IMAGE → SEARCHABLE PDF ----------------
        if (conversionType === "image->searchable-pdf") {

            console.log("🔍 Image → Searchable PDF started");

            try {
                const { language } = job.data;
                const lang = language || "eng";

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                fs.mkdirSync(outputDir, { recursive: true });

                const pdfPaths = [];

                for (let i = 0; i < files.length; i++) {

                    const file = files[i];

                    if (!file.mimetype.startsWith("image/")) {
                        throw new Error(`❌ Only images allowed: ${file.originalname}`);
                    }

                    const processedImg = path.join(outputDir, `processed-${i}.png`);
                    const outputBase = path.join(outputDir, `page-${i + 1}`);

                    console.log(`🖼 Preprocessing: ${file.originalname}`);

                    // ✅ SAFE Preprocessing (A4 @ 300 DPI)
                    await new Promise((resolve) => {
                        exec(
                            `convert "${file.path}" `
                            + `-density 300 `
                            + `-units PixelsPerInch `
                            + `-resize 2480x3508 `
                            + `-colorspace Gray `
                            + `-normalize `
                            + `-contrast-stretch 0 `
                            + `-sharpen 0x1 `
                            + `-deskew 40% `
                            + `"${processedImg}"`,
                            (error, stdout, stderr) => {

                                if (error) {
                                    console.warn("⚠️ Convert failed → using original image");
                                    console.warn(stderr);
                                }

                                resolve(); // Always resolve (fallback safe)
                            }
                        );
                    });

                    const inputForOCR = fs.existsSync(processedImg)
                        ? processedImg
                        : file.path;

                    console.log(`🔍 OCR: ${file.originalname}`);

                    // ✅ FIXED Tesseract (normal PDF size + selectable text)
                    await new Promise((resolve, reject) => {
                        exec(
                            `tesseract "${inputForOCR}" "${outputBase}" `
                            + `-l ${lang} `
                            + `--oem 1 `
                            + `--psm 6 `
                            + `--dpi 300 `
                            + `-c preserve_interword_spaces=1 `
                            + `pdf`,
                            (error, stdout, stderr) => {

                                if (error) {
                                    console.error("❌ Tesseract failed:");
                                    console.error(stderr);
                                    reject(error);
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });

                    pdfPaths.push(`${outputBase}.pdf`);
                }

                let finalOutputPath;

                // ✅ SINGLE PAGE
                if (pdfPaths.length === 1) {

                    finalOutputPath = path.join(outputDir, "searchable.pdf");
                    fs.renameSync(pdfPaths[0], finalOutputPath);

                } else {

                    console.log("📄 Merging OCR pages...");

                    const mergedPdf = await PDFDocument.create();

                    for (const pdfPath of pdfPaths) {

                        const pdfBytes = fs.readFileSync(pdfPath);
                        const pdf = await PDFDocument.load(pdfBytes);

                        const copiedPages = await mergedPdf.copyPages(
                            pdf,
                            pdf.getPageIndices()
                        );

                        copiedPages.forEach(p => mergedPdf.addPage(p));
                        fs.unlinkSync(pdfPath);
                    }

                    const mergedBytes = await mergedPdf.save();

                    finalOutputPath = path.join(outputDir, "searchable.pdf");
                    fs.writeFileSync(finalOutputPath, mergedBytes);
                }

                console.log(`✅ Searchable PDF created (${lang})`);

                return { success: true, outputPath: finalOutputPath };

            } catch (err) {

                console.error("❌ Image → Searchable PDF FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF → SEARCHABLE PDF ----------------
        if (conversionType === "pdf->searchable-pdf") {
            console.log("🔍 PDF → Searchable PDF started");

            try {
                const { language } = job.data;
                const lang = language || "eng";

                const pdfFile = files[0];
                const outputDir = path.join("uploads", "tmp", jobId, "output");
                const imagesDir = path.join(outputDir, "images");

                fs.mkdirSync(imagesDir, { recursive: true });

                const poppler = new Poppler();

                // ✅ Convert PDF → Images (safe options)
                await poppler.pdfToCairo(
                    pdfFile.path,
                    path.join(imagesDir, "page"),
                    { pngFile: true }
                );

                const imageFiles = fs.readdirSync(imagesDir).sort();
                const pdfPaths = [];

                for (const imgFile of imageFiles) {
                    const imgPath = path.join(imagesDir, imgFile);
                    const processedImg = path.join(imagesDir, `processed-${imgFile}`);

                    // ✅ Enhanced preprocessing
                    await new Promise(resolve => {
                        exec(
                            `convert "${imgPath}" \
                        -density 300 \
                        -units PixelsPerInch \
                        -colorspace Gray \
                        -normalize \
                        -contrast-stretch 0 \
                        -sharpen 0x1 \
                        -deskew 40% \
                        "${processedImg}"`,
                            () => resolve()
                        );
                    });

                    const inputForOCR = fs.existsSync(processedImg)
                        ? processedImg
                        : imgPath;

                    const outputBase = path.join(outputDir, `ocr-${imgFile}`);

                    console.log(`🔍 OCR: ${imgFile}`);

                    // ✅ Improved Tesseract OCR
                    await new Promise((resolve, reject) => {
                        exec(
                            `tesseract "${inputForOCR}" "${outputBase}" \
                        -l ${lang} \
                        --oem 1 \
                        --psm 6 \
                        -c preserve_interword_spaces=1 \
                        pdf`,
                            (error, stdout, stderr) => {
                                if (error) {
                                    console.error(stderr);
                                    reject(error);
                                } else resolve();
                            }
                        );
                    });

                    pdfPaths.push(`${outputBase}.pdf`);
                }

                const mergedPdf = await PDFDocument.create();

                for (const pdfPath of pdfPaths) {
                    const pdfBytes = fs.readFileSync(pdfPath);
                    const pdf = await PDFDocument.load(pdfBytes);

                    const copiedPages = await mergedPdf.copyPages(
                        pdf,
                        pdf.getPageIndices()
                    );

                    copiedPages.forEach(p => mergedPdf.addPage(p));
                    fs.unlinkSync(pdfPath);
                }

                const mergedBytes = await mergedPdf.save();
                const finalOutputPath = path.join(outputDir, "searchable.pdf");

                fs.writeFileSync(finalOutputPath, mergedBytes);

                console.log(`✅ Searchable PDF created (${lang})`);

                return { success: true, outputPath: finalOutputPath };

            } catch (err) {
                console.error("❌ PDF → Searchable PDF FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF REPAIR ----------------
        if (conversionType === "pdf->repair") {

            console.log("🛠 PDF Repair started");

            try {
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "repaired.pdf");

                await new Promise((resolve, reject) => {

                    // ✅ Stage 1 — qpdf linearize (auto repair)
                    exec(
                        `qpdf --linearize "${inputPdf}" "${outputPath}"`,
                        (error, stdout, stderr) => {

                            console.log("qpdf stdout:", stdout);
                            console.log("qpdf stderr:", stderr);

                            if (error || !fs.existsSync(outputPath)) {
                                console.warn("⚠️ qpdf failed → trying Ghostscript");
                                return ghostscriptFallback();
                            }

                            validateWithQpdf();
                        }
                    );

                    // ✅ Validate qpdf output
                    function validateWithQpdf() {
                        exec(
                            `qpdf --check "${outputPath}"`,
                            (checkError, checkStdout, checkStderr) => {

                                console.log("qpdf check stdout:", checkStdout);
                                console.log("qpdf check stderr:", checkStderr);

                                if (checkError) {
                                    console.warn("❌ qpdf output invalid → trying Ghostscript");
                                    return ghostscriptFallback();
                                }

                                validatePages();
                            }
                        );
                    }

                    // ✅ Stage 2 — Ghostscript fallback
                    function ghostscriptFallback() {
                        exec(
                            `gs -o "${outputPath}" -sDEVICE=pdfwrite "${inputPdf}"`,
                            (gsError, gsStdout, gsStderr) => {

                                console.log("gs stdout:", gsStdout);
                                console.log("gs stderr:", gsStderr);

                                if (gsError || !fs.existsSync(outputPath)) {
                                    console.warn("⚠️ Ghostscript failed → fallback copy");
                                    fs.copyFileSync(inputPdf, outputPath);
                                    return validatePages();
                                }

                                console.log("✅ Ghostscript repair successful");
                                validatePages();
                            }
                        );
                    }

                    // ✅ FINAL VALIDATION — Check page count
                    function validatePages() {
                        exec(
                            `pdfinfo "${outputPath}"`,
                            (infoError, infoStdout, infoStderr) => {

                                console.log("pdfinfo stdout:", infoStdout);
                                console.log("pdfinfo stderr:", infoStderr);

                                const match = infoStdout.match(/Pages:\s+(\d+)/);

                                if (!match) {
                                    console.error("❌ Could not determine page count");
                                    return reject(new Error("Invalid repaired PDF"));
                                }

                                const pages = parseInt(match[1]);

                                if (pages === 0) {
                                    console.error("❌ Repaired PDF has ZERO pages");
                                    return reject(new Error("PDF too corrupted — content unrecoverable"));
                                }

                                console.log(`✅ Repaired PDF valid with ${pages} pages`);
                                resolve();
                            }
                        );
                    }
                });

                const stats = fs.statSync(outputPath);
                console.log("📊 Final repaired PDF size:", stats.size);

                if (stats.size < 1000) {
                    throw new Error("❌ Repaired PDF too small");
                }

                console.log("✅ PDF Repair completed");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF Repair FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF → GRAYSCALE ----------------
        if (conversionType === "pdf->grayscale") {

            console.log("⚫ PDF → Grayscale started");

            try {
                const inputPdf = files[0].path;

                // ✅ CONSISTENT OUTPUT DIRECTORY
                const outputDir = path.join("uploads", "tmp", jobId, "output");

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const outputPath = path.join(outputDir, "grayscale.pdf");

                // ✅ Ghostscript grayscale conversion
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dQUIET `
                        + `-sColorConversionStrategy=Gray `
                        + `-dProcessColorModel=/DeviceGray `
                        + `-dCompatibilityLevel=1.4 `
                        + `-sOutputFile="${outputPath}" `
                        + `"${inputPdf}"`,
                        (error, stdout, stderr) => {

                            console.log("gs stdout:", stdout);
                            console.log("gs stderr:", stderr);

                            if (error) {
                                console.error("❌ Grayscale failed");
                                reject(error);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                // ✅ VERIFY OUTPUT
                const stats = fs.statSync(outputPath);
                console.log("📊 Grayscale PDF size:", stats.size);

                if (stats.size < 1000) {
                    throw new Error("❌ Grayscale PDF too small / empty");
                }

                console.log("✅ PDF converted to Grayscale");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF → Grayscale FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → RENDER IMAGES ----------------
        if (conversionType === "pdf->render-images") {

            console.log("🖼 PDF → Render Images started");

            try {
                const inputPdf = files[0].path;

                // ✅ Standard output path
                const outputDir = path.join("uploads", "tmp", jobId, "output", "images");
                fs.mkdirSync(outputDir, { recursive: true });

                const poppler = new Poppler();

                try {
                    // 🥇 PRIMARY → Poppler renderer
                    console.log("🚀 Trying Poppler renderer...");

                    await poppler.pdfToCairo(
                        inputPdf,
                        path.join(outputDir, "page"),
                        { pngFile: true }
                    );

                    console.log("✅ Poppler rendering successful");

                } catch (popplerError) {

                    // 🛠 FALLBACK → Ghostscript
                    console.warn("⚠️ Poppler failed → Falling back to Ghostscript");

                    const outputPattern = path.join(outputDir, "page-%03d.png");

                    await new Promise((resolve, reject) => {
                        exec(
                            `gs -dNOPAUSE -dBATCH -dQUIET `
                            + `-sDEVICE=png16m `
                            + `-r300 `
                            + `-o "${outputPattern}" `
                            + `"${inputPdf}"`,
                            (error, stdout, stderr) => {

                                console.log("gs stdout:", stdout);
                                console.log("gs stderr:", stderr);

                                if (error) reject(error);
                                else resolve();
                            }
                        );
                    });

                    console.log("✅ Ghostscript fallback successful");
                }

                // ✅ Validate output
                const images = fs.readdirSync(outputDir)
                    .filter(f => f.endsWith(".png"));

                console.log(`📸 Rendered pages: ${images.length}`);

                if (images.length === 0) {
                    throw new Error("❌ No images rendered from PDF");
                }

                return { success: true };

            } catch (err) {
                console.error("❌ PDF → Render Images FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → EXTRACT EMBEDDED IMAGES ----------------
        if (conversionType === "pdf->extract-images") {

            console.log("🖼 PDF → Extract Embedded Images started");

            try {
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output", "extracted-images");
                fs.mkdirSync(outputDir, { recursive: true });

                await new Promise((resolve, reject) => {
                    exec(
                        `pdfimages -all "${inputPdf}" "${path.join(outputDir, "img")}"`,
                        (error, stdout, stderr) => {

                            console.log("pdfimages stdout:", stdout);
                            console.log("pdfimages stderr:", stderr);

                            if (error) {
                                console.error("❌ pdfimages failed");
                                reject(error);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                // ✅ Validate extraction
                const images = fs.readdirSync(outputDir)
                    .filter(f =>
                        f.endsWith(".png") ||
                        f.endsWith(".jpg") ||
                        f.endsWith(".jpeg")
                    );

                console.log(`📸 Extracted embedded images: ${images.length}`);

                if (images.length === 0) {
                    throw new Error("❌ No embedded images found in PDF");
                }

                console.log("✅ Embedded images extracted successfully");

                return { success: true };

            } catch (err) {
                console.error("❌ PDF → Extract Embedded Images FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → REMOVE BLANK PAGES (PRO MODE FIXED) ----------------
        if (conversionType === "pdf->remove-blank") {

            console.log("🧹 PDF → Remove Blank Pages (Pro Mode)");

            try {
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                const tempDir = path.join(outputDir, "blank-check");

                fs.mkdirSync(tempDir, { recursive: true });

                const poppler = new Poppler();

                // 1️⃣ Render pages → PNG
                console.log("🖼 Rendering pages...");

                await poppler.pdfToCairo(
                    inputPdf,
                    path.join(tempDir, "page"),
                    { pngFile: true }
                );

                const imageFiles = fs.readdirSync(tempDir)
                    .filter(f => f.endsWith(".png"))
                    .sort();

                if (imageFiles.length === 0) {
                    throw new Error("❌ No pages rendered");
                }

                const keepPages = [];

                // 2️⃣ Pixel-based blank detection
                for (let i = 0; i < imageFiles.length; i++) {

                    const imgPath = path.join(tempDir, imageFiles[i]);

                    const mean = await new Promise((resolve) => {
                        exec(
                            `convert "${imgPath}" -colorspace Gray -format "%[fx:mean]" info:`,
                            (error, stdout, stderr) => {

                                if (error) {
                                    console.warn(`⚠️ Mean detection failed for page ${i + 1}`);
                                    console.warn(stderr);
                                    resolve(0); // safe fallback → treat as NOT blank
                                } else {
                                    resolve(parseFloat(stdout.trim()));
                                }
                            }
                        );
                    });

                    console.log(`📊 Page ${i + 1} mean: ${mean}`);

                    // ✅ FIXED THRESHOLD
                    const isBlank = mean > 0.995;

                    if (isBlank) {
                        console.log(`🗑 Blank page detected: ${i + 1}`);
                    } else {
                        keepPages.push(i);
                    }
                }

                if (keepPages.length === 0) {
                    throw new Error("❌ All pages detected blank");
                }

                console.log(`✅ Keeping ${keepPages.length} / ${imageFiles.length} pages`);

                // 3️⃣ Rebuild PDF
                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const newPdf = await PDFDocument.create();

                const pages = await newPdf.copyPages(pdfDoc, keepPages);
                pages.forEach(p => newPdf.addPage(p));

                const cleanedBytes = await newPdf.save();

                const outputPath = path.join(outputDir, "no-blanks.pdf");
                fs.writeFileSync(outputPath, cleanedBytes);

                // ✅ Validate output
                const stats = fs.statSync(outputPath);
                console.log("📊 Cleaned PDF size:", stats.size);

                if (stats.size < 1000) {
                    throw new Error("❌ Output PDF invalid");
                }

                // 4️⃣ Cleanup
                console.log("🧹 Cleaning temp files...");
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true });
                }

                console.log("✅ Blank pages removed successfully");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ Remove Blank FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → FLATTEN ----------------
        if (conversionType === "pdf->flatten") {

            console.log("📄 PDF → Flatten started");

            try {
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                fs.mkdirSync(outputDir, { recursive: true });

                const flattenedFields = path.join(outputDir, "fields_flattened.pdf");
                const outputPath = path.join(outputDir, "flattened.pdf");

                console.log("🚀 Step 1: Flattening form fields with qpdf...");

                // Step 1: qpdf flattens interactive form fields & annotations
                await new Promise((resolve, reject) => {
                    exec(
                        `qpdf --flatten-annotations=all --stream-data=compress "${inputPdf}" "${flattenedFields}"`,
                        (error, stdout, stderr) => {
                            console.log("qpdf stdout:", stdout);
                            console.log("qpdf stderr:", stderr);
                            if (error) {
                                console.error("❌ qpdf flatten failed:", error);
                                reject(error);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                console.log("🚀 Step 2: Burning to static PDF with Ghostscript...");

                // Step 2: Ghostscript burns everything to static graphics
                await new Promise((resolve, reject) => {
                    exec(
                        `gs -sDEVICE=pdfwrite `
                        + `-dNOPAUSE -dBATCH -dQUIET `
                        + `-dCompatibilityLevel=1.4 `
                        + `-dFlattenAnnotations `
                        + `-dPrinted `
                        + `-dNoInterpolate `
                        + `-sOutputFile="${outputPath}" `
                        + `"${flattenedFields}"`,
                        (error, stdout, stderr) => {
                            console.log("gs stdout:", stdout);
                            console.log("gs stderr:", stderr);
                            if (error) {
                                console.error("❌ Ghostscript failed:", error);
                                reject(error);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                // Cleanup intermediate file
                try { fs.unlinkSync(flattenedFields); } catch (_) { }

                const stats = fs.statSync(outputPath);
                console.log("📊 Flattened PDF size:", stats.size);

                if (stats.size < 1000) {
                    throw new Error("❌ Flattened PDF invalid / empty");
                }

                console.log("✅ PDF Flattened successfully");
                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF → Flatten FAILED:", err);
                throw err;
            }
        }

        // ---------------- PDF → METADATA ----------------
        if (conversionType === "pdf->metadata") {

            console.log("🧾 PDF → Metadata extraction started");

            try {
                const inputPdf = files[0].path;

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                fs.mkdirSync(outputDir, { recursive: true });

                const jsonPath = path.join(outputDir, "metadata.json");
                const txtPath = path.join(outputDir, "metadata.txt");

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const meta = {
                    title: pdfDoc.getTitle(),
                    author: pdfDoc.getAuthor(),
                    subject: pdfDoc.getSubject(),
                    keywords: pdfDoc.getKeywords(),
                    creator: pdfDoc.getCreator(),
                    producer: pdfDoc.getProducer(),
                    creationDate: pdfDoc.getCreationDate(),
                    modificationDate: pdfDoc.getModificationDate(),
                };

                console.log("📊 Extracted metadata:", meta);

                // ✅ Write JSON
                fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

                // ✅ Write TXT (pretty human-readable)
                const prettyText = `
PDF METADATA
============

Title: ${meta.title || "-"}
Author: ${meta.author || "-"}
Subject: ${meta.subject || "-"}
Keywords: ${meta.keywords || "-"}

Creator: ${meta.creator || "-"}
Producer: ${meta.producer || "-"}

Creation Date: ${meta.creationDate || "-"}
Modification Date: ${meta.modificationDate || "-"}
`;

                fs.writeFileSync(txtPath, prettyText.trim());

                console.log("✅ Metadata JSON + TXT created");

                return {
                    success: true,
                    output: {
                        json: jsonPath,
                        txt: txtPath
                    }
                };

            } catch (err) {
                console.error("❌ PDF → Metadata FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → EXTRACT PAGES ----------------
        if (conversionType === "pdf->extract") {

            console.log("📑 PDF → Extract Pages started");

            try {
                if (!files || files.length === 0) {
                    throw new Error("❌ No PDF file provided");
                }

                const inputPdf = files[0].path;
                const { pages } = job.data;

                if (!pages || pages.trim() === "") {
                    throw new Error("❌ Pages parameter required (e.g. 2,5,8)");
                }

                const outputDir = path.join("uploads", "tmp", jobId, "output");
                fs.mkdirSync(outputDir, { recursive: true });

                const outputPath = path.join(outputDir, "extracted-pages.pdf");

                // ✅ Convert pages → zero-based indices
                const extractPages = pages.split(",")
                    .map(p => p.trim())
                    .filter(p => p !== "")
                    .map(p => {
                        const pageNum = parseInt(p, 10);

                        if (isNaN(pageNum)) {
                            throw new Error(`❌ Invalid page value: "${p}"`);
                        }

                        return pageNum - 1;
                    });

                const pdfBytes = fs.readFileSync(inputPdf);
                const pdfDoc = await PDFDocument.load(pdfBytes);

                const totalPages = pdfDoc.getPageCount();
                console.log(`📄 Total pages in PDF: ${totalPages}`);

                // ✅ Validate page numbers
                extractPages.forEach(p => {
                    if (p < 0 || p >= totalPages) {
                        throw new Error(`❌ Invalid page number: ${p + 1}`);
                    }
                });

                // ✅ Remove duplicates
                const uniquePages = [...new Set(extractPages)];

                console.log(`✅ Extracting pages: ${uniquePages.map(p => p + 1).join(", ")}`);

                const newPdf = await PDFDocument.create();

                const copiedPages = await newPdf.copyPages(pdfDoc, uniquePages);
                copiedPages.forEach(page => newPdf.addPage(page));

                const extractedBytes = await newPdf.save();
                fs.writeFileSync(outputPath, extractedBytes);

                const stats = fs.statSync(outputPath);
                console.log("📊 Extracted PDF size:", stats.size);

                if (stats.size < 1000) {
                    throw new Error("❌ Extracted PDF invalid / empty");
                }

                console.log("✅ Pages extracted successfully");

                return { success: true, outputPath };

            } catch (err) {
                console.error("❌ PDF → Extract Pages FAILED:", err);
                throw err;
            }
        }
        // ---------------- PDF → HTML PREVIEW (CLEAN MODE) ----------------
        if (conversionType === "pdf->html") {

            console.log("🌐 PDF → HTML Preview started");

            try {
                const inputPdf = files[0].path;

                const baseDir = path.join("uploads", "tmp", jobId, "output");
                const assetsDir = path.join(baseDir, "assets");

                fs.mkdirSync(assetsDir, { recursive: true });

                const poppler = new Poppler();

                console.log("🖼 Rendering PDF pages → PNG...");

                await poppler.pdfToCairo(
                    inputPdf,
                    path.join(assetsDir, "page"),
                    { pngFile: true }
                );

                const images = fs.readdirSync(assetsDir)
                    .filter(f => f.endsWith(".png"))
                    .sort();

                if (images.length === 0) {
                    throw new Error("❌ No pages rendered");
                }

                console.log(`📸 Pages rendered: ${images.length}`);

                const htmlPath = path.join(baseDir, "preview.html");

                console.log("🌐 Generating HTML preview...");

                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>PDF Preview</title>
    <style>
        body {
            margin: 0;
            background: #1e1e1e;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: Arial, sans-serif;
        }
        img {
            width: 100%;
            max-width: 900px;
            margin: 20px 0;
            background: white;
            box-shadow: 0 0 12px rgba(0,0,0,0.6);
        }
    </style>
</head>
<body>
    ${images.map(img => `<img src="assets/${img}" />`).join("")}
</body>
</html>
`;

                fs.writeFileSync(htmlPath, htmlContent);

                console.log("✅ HTML Preview created");

                return { success: true, outputPath: htmlPath };

            } catch (err) {
                console.error("❌ PDF → HTML Preview FAILED:", err);
                throw err;
            }
        }
// ---------------- PDF → KEY POINTS (SMART ORDERED MODE) ----------------
if (conversionType === "pdf->keypoints") {

    console.log("🎯 PDF → Key Points started");

    try {
        const poppler = new Poppler();

        const inputPdf = files[0].path;
        const outputDir = path.join("uploads", "tmp", jobId, "output");

        fs.mkdirSync(outputDir, { recursive: true });

        const textPath = path.join(outputDir, "extracted.txt");
        const outputPath = path.join(outputDir, "keypoints.txt");

        console.log("📄 Extracting text...");
        await poppler.pdfToText(inputPdf, textPath);

        const rawText = fs.readFileSync(textPath, "utf-8");

        const cleanText = rawText
            .replace(/\f/g, " ")
            .replace(/Page\s+\d+/gi, "")
            .replace(/\s+/g, " ")
            .trim();

        if (!cleanText || cleanText.length < 80) {
            throw new Error("Not enough readable text");
        }

        console.log("🧠 Analyzing sentences...");

        const doc = nlp.readDoc(cleanText);
        const sentences = doc.sentences().out();

        if (!sentences.length) {
            throw new Error("No sentences detected");
        }

        // ✅ Basic stopwords
        const stopwords = new Set([
            "the","and","with","from","this","that","have","were",
            "their","there","about","which","into","than","then",
            "also","such","these","those","been","being"
        ]);

        const scored = sentences.map((sentence, index) => {

            const tokens = nlp.readDoc(sentence).tokens().out();

            // ✅ Filter junk / tiny sentences
            if (
                sentence.length < 40 ||
                /copyright|all rights reserved|figure\s+\d|table\s+\d/i.test(sentence)
            ) {
                return null;
            }

            // ✅ Keyword density boost
            const words = sentence.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
            const keywordHits = words.filter(w => !stopwords.has(w)).length;

            const score =
                tokens.length +
                keywordHits * 2 +          // boost meaningful words
                sentence.length * 0.05;    // mild length bias

            return {
                text: sentence,
                score,
                index   // ⭐ preserve original order
            };
        }).filter(Boolean);

        if (!scored.length) {
            throw new Error("No meaningful sentences found");
        }

        // ✅ Pick top N by score
        const topRanked = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        // ⭐ Re-sort by original order
        const orderedKeyPoints = topRanked
            .sort((a, b) => a.index - b.index)
            .map(s => s.text);

        const finalOutput = `
KEY POINTS
==========

${orderedKeyPoints.map(p => `• ${p}`).join("\n\n")}

----------------
Points extracted: ${orderedKeyPoints.length}
`;

        fs.writeFileSync(outputPath, finalOutput.trim());

        console.log("✅ Key Points extracted");

        return { success: true, outputPath };

    } catch (err) {
        console.error("❌ Key Points FAILED:", err.message);
        throw err;
    }
}
//---------------- PDF → KEYWORDS ----------------
if (conversionType === "pdf->keywords") {

    console.log("🏷 PDF → Keywords started");

    try {
        const poppler = new Poppler();
        const inputPdf = files[0].path;

        const outputDir = path.join("uploads", "tmp", jobId, "output");
        fs.mkdirSync(outputDir, { recursive: true });

        const textPath = path.join(outputDir, "extracted.txt");

        await poppler.pdfToText(inputPdf, textPath);
        const text = fs.readFileSync(textPath, "utf-8");

        const stopwords = new Set([
            "the","and","with","from","this","that","have","were",
            "their","there","about","which","into","than","then",
            "also","such","these","those","been","being"
        ]);

        const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const freq = {};

        for (const w of words) {
            if (!stopwords.has(w)) {
                freq[w] = (freq[w] || 0) + 1;
            }
        }

        const topKeywords = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(e => e[0]);

        const outputPath = path.join(outputDir, "keywords.txt");

        fs.writeFileSync(
            outputPath,
            `TOP KEYWORDS\n============\n\n${topKeywords.map(k => `• ${k}`).join("\n")}`
        );

        console.log("✅ Keywords extracted");

        return { success: true, outputPath };

    } catch (err) {
        console.error("❌ Keywords FAILED:", err.message);
        throw err;
    }
}
// // ---------------- PDF → ENTITIES (STRICT SMART MODE) ----------------
// if (conversionType === "pdf->entities") {

//     console.log("✨ PDF → Entity extraction started");

//     try {
//         const poppler = new Poppler();
//         const inputPdf = files[0].path;

//         const outputDir = path.join("uploads", "tmp", jobId, "output");
//         fs.mkdirSync(outputDir, { recursive: true });

//         const textPath = path.join(outputDir, "extracted.txt");

//         console.log("📄 Extracting text...");
//         await poppler.pdfToText(inputPdf, textPath);

//         let text = fs.readFileSync(textPath, "utf-8");

//         if (!text || text.length < 50) {
//             throw new Error("Bad text extraction");
//         }

//         // ✅ STEP 1 — HARD TEXT CLEANING
//         text = text
//             .replace(/\f/g, " ")
//             .replace(/Page\s+\d+/gi, "")
//             .replace(/\n+/g, " ")
//             .replace(/\s+/g, " ")
//             .replace(/[^\w\s.,&-]/g, "")
//             .trim();

//         // ✅ STEP 2 — Fix ALL CAPS words
//         text = text.replace(/\b[A-Z]{3,}\b/g, w =>
//             w.charAt(0) + w.slice(1).toLowerCase()
//         );

//         console.log("🧪 Cleaned text sample:", text.slice(0, 150));

//         console.log("🧠 Running NLP entity detection...");

//         const doc = compromise(text);

//         // 🧹 STRICT HUMAN NAME FILTER
//         const isLikelyHumanName = (name) => {

//             const cleaned = name.trim();

//             // ❌ Reject weird characters
//             if (/[^a-zA-Z\s]/.test(cleaned)) return false;

//             const parts = cleaned.split(/\s+/);

//             // ❌ Reject too short / long
//             if (parts.length < 2 || parts.length > 5) return false;

//             // ❌ Reject generic headings/phrases
//             if (/analysis|types|recommendations|reflection|prevention|harassment|ethical|values|violated|remedies/i.test(cleaned))
//                 return false;

//             // ✅ Ensure proper capitalization
//             if (!parts.every(p => /^[A-Z][a-z]+$/.test(p)))
//                 return false;

//             return true;
//         };

//         // 🥇 NLP-based detection
//         let people = doc.people().out("array");

//         // 🥈 Regex fallback (multi-word names)
//         const regexNames =
//             text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || [];

//         people = [...people, ...regexNames];

//         // 🧹 Final cleanup
//         people = [...new Set(people)]
//             .map(p => p.trim())
//             .filter(isLikelyHumanName)
//             .slice(0, 10);

//         const organizations = [...new Set(doc.organizations().out("array"))]
//             .filter(o => o.length > 2 && o.length < 60)
//             .slice(0, 10);

//         const places = [...new Set(doc.places().out("array"))]
//             .filter(p => p.length > 2 && p.length < 60)
//             .slice(0, 10);

//         const entities = { people, organizations, places };

//         console.log("🧪 Entities detected:", entities);

//         const jsonPath = path.join(outputDir, "entities.json");
//         const txtPath = path.join(outputDir, "entities.txt");

//         const prettyOutput = `
// DOCUMENT ENTITIES
// ================

// 👤 People:
// ${people.length ? people.map(p => `• ${p}`).join("\n") : "• None detected"}

// 🏢 Organizations:
// ${organizations.length ? organizations.map(o => `• ${o}`).join("\n") : "• None detected"}

// 📍 Places:
// ${places.length ? places.map(p => `• ${p}`).join("\n") : "• None detected"}
// `;

//         fs.writeFileSync(jsonPath, JSON.stringify(entities, null, 2));
//         fs.writeFileSync(txtPath, prettyOutput.trim());

//         console.log("✅ Entity extraction completed");

//         return {
//             success: true,
//             output: { json: jsonPath, txt: txtPath }
//         };

//     } catch (err) {
//         console.error("❌ Entities FAILED:", err.message);
//         throw err;
//     }
// }
// ---------------- FILE EXPIRY / SELF-DESTRUCT ----------------
if (conversionType === "file->expiry") {

    console.log("⏳ File Expiry scheduled");

    try {
        const { expiryMinutes, expiryHours } = job.data;

        const minutes =
            expiryMinutes
                ? parseInt(expiryMinutes)
                : expiryHours
                    ? parseInt(expiryHours) * 60
                    : 60; // default 1 hour

        const expiryMs = minutes * 60 * 1000;

        const baseDir = path.join("uploads", "tmp", jobId);

        if (!fs.existsSync(baseDir)) {
            throw new Error("❌ Job folder not found");
        }

        console.log(`🕒 Will self-destruct in ${minutes} minutes`);

        setTimeout(() => {
            try {
                if (fs.existsSync(baseDir)) {
                    fs.rmSync(baseDir, { recursive: true, force: true });
                    console.log(`💥 Job ${jobId} self-destructed`);
                }
            } catch (err) {
                console.warn(`⚠️ Expiry cleanup failed for ${jobId}`);
            }
        }, expiryMs);

        return { success: true };

    } catch (err) {
        console.error("❌ File Expiry FAILED:", err.message);
        throw err;
    }
}
// ---------------- PDF → SIMILARITY ----------------
if (conversionType === "pdf->similarity") {

    console.log("📊 PDF Similarity started");

    try {
        if (!files || files.length !== 2) {
            throw new Error("❌ Exactly 2 PDFs required");
        }

        const poppler = new Poppler();

        const outputDir = path.join("uploads", "tmp", jobId, "output");
        fs.mkdirSync(outputDir, { recursive: true });

        const text1Path = path.join(outputDir, "pdf1.txt");
        const text2Path = path.join(outputDir, "pdf2.txt");

        console.log("📄 Extracting PDF 1...");
        await poppler.pdfToText(files[0].path, text1Path);

        console.log("📄 Extracting PDF 2...");
        await poppler.pdfToText(files[1].path, text2Path);

        const clean = (text) =>
            text
                .replace(/\f/g, " ")
                .replace(/Page\s+\d+/gi, "")
                .replace(/\s+/g, " ")
                .trim();

        const textA = clean(fs.readFileSync(text1Path, "utf-8"));
        const textB = clean(fs.readFileSync(text2Path, "utf-8"));

        if (textA.length < 50 || textB.length < 50) {
            throw new Error("❌ Poor text extraction");
        }

        console.log("🧠 Computing similarity...");

        const similarity = cosineSimilarity(textA, textB);
        const percent = (similarity * 100).toFixed(2);

        const report = `
PDF SIMILARITY REPORT
=====================

Similarity Score: ${percent} %

Interpretation:
${percent > 85 ? "🟢 Highly Similar" :
percent > 60 ? "🟡 Moderately Similar" :
percent > 30 ? "🟠 Low Similarity" :
"🔴 Very Different"}

----------------
Generated: ${new Date().toLocaleString()}
`;

        const outputPath = path.join(outputDir, "similarity.txt");
        fs.writeFileSync(outputPath, report.trim());

        console.log(`✅ Similarity: ${percent}%`);

        return { success: true, outputPath };

    } catch (err) {
        console.error("❌ PDF Similarity FAILED:", err.message);
        throw err;
    }
}
        console.log("❌ Unsupported conversion");
        return { success: false };
    },
    { connection: redisConnection }
);

console.log("🚀 Conversion worker started");

worker.on("completed", async (job) => {
  try {
    console.log(`✅ Job completed: ${job.data.jobId}`);

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        completed_at: new Date(),
      })
      .eq("id", job.data.jobId);

  } catch (err) {
    console.error("❌ Failed updating completed status:", err.message);
  }
});

worker.on("failed", async (job, err) => {
  try {
    console.log(`❌ Job failed: ${job?.data?.jobId}`);

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        failed_at: new Date(),
        error_message: err?.message || "Unknown error",
      })
      .eq("id", job.data.jobId);

  } catch (updateErr) {
    console.error("❌ Failed updating failed status:", updateErr.message);
  }
});

