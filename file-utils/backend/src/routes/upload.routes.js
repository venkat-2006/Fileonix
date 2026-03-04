import { Router } from "express";
import { upload, verifyUploadedFiles } from "../config/multer.js";
import { uploadFiles } from "../controllers/upload.controller.js";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/",
  verifyAuth,

  // Generate jobId before multer so files go into correct folder
  (req, res, next) => {
    req.jobId = uuidv4();
    next();
  },

  upload.array("files"),

  // Verify file signatures (security layer)
  verifyUploadedFiles,

  uploadFiles
);

export default router;