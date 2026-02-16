import fs from "fs";
import path from "path";

// Ensure directory exists helper
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Patch writeFileSync
const originalWriteFileSync = fs.writeFileSync;
fs.writeFileSync = function (filePath, data, options) {
  ensureDir(filePath);
  return originalWriteFileSync.call(fs, filePath, data, options);
};

// Patch createWriteStream
const originalCreateWriteStream = fs.createWriteStream;
fs.createWriteStream = function (filePath, options) {
  ensureDir(filePath);
  return originalCreateWriteStream.call(fs, filePath, options);
};

export default fs;
