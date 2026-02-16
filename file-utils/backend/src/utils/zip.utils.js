import archiver from "archiver";
import fs from "fs";
import path from "path";

export const zipJobResults = (jobId) => {
  return new Promise((resolve, reject) => {
    const jobDir = path.join("uploads", "tmp", jobId);
    const zipPath = path.join("uploads", "tmp", `${jobId}-results.zip`);

    if (!fs.existsSync(jobDir)) {
      return reject(new Error("Job folder not found"));
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log("✅ ZIP created:", zipPath);
      resolve(zipPath);
    });

    archive.on("error", reject);

    archive.pipe(output);

    
    archive.glob("**/*", {
      cwd: jobDir,
      ignore: ["*.zip"]
    });

    archive.finalize();
  });
};
