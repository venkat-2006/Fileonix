import { Router } from "express";
import { upload, verifyUploadedFiles } from "../config/multer.js";
import { uploadFiles } from "../controllers/upload.controller.js";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/",
  verifyAuth,

  // Generate jobId before upload so multer stores files correctly
  (req, res, next) => {
    req.jobId = uuidv4();
    next();
  },

  // Wrap multer to catch its errors properly
  (req, res, next) => {
    upload.array("files")(req, res, function (err) {
      if (err) {

        // Handle file size errors
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large"
          });
        }

        // Handle file count errors
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            error: "Too many files uploaded"
          });
        }

        // Handle extension/mimetype errors
        return res.status(400).json({
          error: err.message
        });
      }

      next();
    });
  },

  // Verify file signatures (magic byte validation)
  verifyUploadedFiles,

  // Controller
  uploadFiles
);

export default router;