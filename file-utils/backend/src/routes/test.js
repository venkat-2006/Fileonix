import express from "express";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/test", verifyAuth, (req, res) => {
  res.json({
    message: "✅ Authenticated request",
    user: req.user,
  });
});

export default router;