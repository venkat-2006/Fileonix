import { Router } from "express";
import { createJob, getJobStatus } from "../controllers/job.controller.js";

const router = Router();

router.post("/", createJob);
router.get("/:jobId", getJobStatus);

export default router;
