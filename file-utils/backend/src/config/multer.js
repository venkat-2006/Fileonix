import multer from "multer";
import path from "path";
import fs from "fs";
import { fileTypeFromFile } from "file-type";
import { MAX_FILE_SIZE_MB } from "../utils/constants.js";

const allowedMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain"
];

const allowedExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt"
];

// ---------- STORAGE ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const jobId = req.jobId;

      if (!jobId) {
        return cb(new Error("Missing jobId"));
      }

      const uploadDir = path.join("uploads", "tmp", jobId);

      fs.mkdirSync(uploadDir, { recursive: true });

      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    try {
      const safeName = file.originalname
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const filename = `${Date.now()}_${safeName}`;

      cb(null, filename);
    } catch (err) {
      cb(err);
    }
  }
});

// ---------- FILTER ----------
const fileFilter = (req, file, cb) => {

  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Invalid file extension: ${ext}`), false);
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error(`Unsupported MIME type: ${file.mimetype}`), false);
  }

  cb(null, true);
};

// ---------- MULTER ----------
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 5
  }
});

// ---------- MAGIC BYTE VALIDATION ----------
export const verifyUploadedFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    for (const file of req.files) {

      const type = await fileTypeFromFile(file.path);

      // txt files may return undefined
      if (!type && file.mimetype === "text/plain") continue;

      if (!type || !allowedMimeTypes.includes(type.mime)) {
        fs.unlinkSync(file.path);

        return res.status(400).json({
          error: "File content does not match allowed type"
        });
      }
    }

    next();

  } catch (err) {
    next(err);
  }
};