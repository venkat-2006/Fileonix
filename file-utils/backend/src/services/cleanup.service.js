import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "tmp");
const FILE_TTL = 2 * 60 * 60 * 1000; // 2 hours

export const cleanupExpiredFiles = async () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return;

    const folders = fs.readdirSync(UPLOADS_DIR);

    for (const folder of folders) {
      const folderPath = path.join(UPLOADS_DIR, folder);

      try {
        const stats = fs.statSync(folderPath);

        // CHANGE HERE
        const age = Date.now() - stats.birthtimeMs;

        if (age > FILE_TTL) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log("🗑 Deleted expired folder:", folder);
        }

      } catch (err) {
        console.error("Folder cleanup error:", err.message);
      }
    }

  } catch (err) {
    console.error("Cleanup service error:", err.message);
  }
};