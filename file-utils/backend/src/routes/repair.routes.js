// import express from "express";
// import fs from "fs";
// import path from "path";

// const router = express.Router();

// router.get("/:jobId", (req, res) => {
//     const { jobId } = req.params;

//     const repairedPath = path.join("uploads", "tmp", jobId, "repaired.pdf");

//     if (!fs.existsSync(repairedPath)) {
//         return res.status(404).json({ error: "Repaired PDF not found" });
//     }

//     res.download(repairedPath, "repaired.pdf");
// });

// export default router;
