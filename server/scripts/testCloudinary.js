import "dotenv/config";
import { uploadBuffer, deleteFile } from "../services/storage.js";

// 1x1 pixel ki chhoti PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const result = await uploadBuffer(png, { folder: "scholarhub/test" });
console.log("Uploaded:", result.secure_url);
console.log("Public id:", result.public_id);
console.log("Resource type:", result.resource_type);
console.log("Bytes:", result.bytes);

const del = await deleteFile(result.public_id, result.resource_type);
console.log("Delete result:", del.result);