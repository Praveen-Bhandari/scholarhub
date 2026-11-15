import "dotenv/config";
import mongoose from "mongoose";
import RefreshToken from "../models/RefreshToken.js";

await mongoose.connect(process.env.MONGO_URI);
await RefreshToken.init();

const user = new mongoose.Types.ObjectId();
const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const t = await RefreshToken.create({
  user,
  tokenHash: "hash-one",
  expiresAt: soon,
});
console.log("Revoked (default):", t.revoked);

// rotation: purana revoke, naya banao
t.revoked = true;
t.replacedByHash = "hash-two";
await t.save();
await RefreshToken.create({ user, tokenHash: "hash-two", expiresAt: soon });
console.log("Rotation saved:", t.revoked === true && t.replacedByHash === "hash-two");

// same hash dobara nahi ban sakta
try {
  await RefreshToken.create({ user, tokenHash: "hash-one", expiresAt: soon });
} catch (err) {
  console.log("Duplicate hash rejected:", err.code === 11000);
}

await RefreshToken.deleteMany({ user });
await mongoose.disconnect();
console.log("Test done");