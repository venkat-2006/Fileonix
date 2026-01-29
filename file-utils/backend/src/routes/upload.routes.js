import { Router } from "express";
import { upload } from "../config/multer.js";
import { uploadFiles } from "../controllers/upload.controller.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.post(
  "/",
  (req, res, next) => {
    req.jobId = uuidv4();
    next();
  },
  upload.array("files"),
  uploadFiles
);

export default router;
