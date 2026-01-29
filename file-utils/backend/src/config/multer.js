import multer from "multer";
import path from "path";
import fs from "fs";
import { MAX_FILE_SIZE_MB } from "../utils/constants.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobId = req.jobId;
    const uploadPath = path.join("uploads", "tmp", jobId);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
  }
});
