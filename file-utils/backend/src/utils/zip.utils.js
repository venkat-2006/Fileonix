import archiver from "archiver";
import fs from "../utils/fsSafe.js";
import path from "path";

export const zipJobResults = (jobId) => {
  return new Promise((resolve, reject) => {
    try {
      const outputDir = path.join("uploads", "tmp", jobId, "output");
      const zipPath = path.join("uploads", "tmp", jobId, "results.zip");

      if (!fs.existsSync(outputDir)) {
        return reject(new Error("Output folder not found"));
      }

      const files = fs.readdirSync(outputDir);
      if (!files.length) {
        return reject(new Error("No output files to zip"));
      }

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        console.log("✅ ZIP created:", zipPath);
        resolve(zipPath);
      });

      output.on("error", reject);
      archive.on("error", reject);

      archive.pipe(output);

      archive.glob("**/*", {
        cwd: outputDir,
        ignore: [
          "images/**",       //  intermediate
          "ocr-pages/**",    //  intermediate
          "processed-*",     // temp files
          "temp.txt"
        ]
      });

      archive.finalize();

    } catch (err) {
      reject(err);
    }
  });
};
