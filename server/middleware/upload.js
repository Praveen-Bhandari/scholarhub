import multer from "multer";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ATTACHMENT_TYPES = [
  ...IMAGE_TYPES,
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];
export function detectType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return "application/zip";
  }
  return null;
}

export function uploadSingle({ field, allowedTypes, maxBytes }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!allowedTypes.includes(file.mimetype)) {
        const err = new Error("File type not allowed");
        err.code = "INVALID_FILE_TYPE";
        return cb(err);
      }
      cb(null, true);
    },
  }).single(field);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`,
            });
          }
          return res.status(400).json({ message: err.message });
        }
        if (err.code === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            message: `File type not allowed. Allowed: ${allowedTypes.join(", ")}`,
          });
        }
        return next(err);
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ message: `No file uploaded (field name must be "${field}")` });
      }

      // asli content check
      const real = detectType(req.file.buffer);
      if (!real || !allowedTypes.includes(real)) {
        return res
          .status(400)
          .json({ message: "File content does not match an allowed type" });
      }

      req.file.detectedType = real;
      next();
    });
  };
}