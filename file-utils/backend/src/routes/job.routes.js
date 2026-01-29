import { Router } from "express";
import { getJobStatus } from "../controllers/job.controller.js";

const router = Router();

router.get("/:jobId", getJobStatus);

export default router;
