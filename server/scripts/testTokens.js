import "dotenv/config";
import mongoose from "mongoose";
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/tokens.js";

const user = { _id: new mongoose.Types.ObjectId(), role: "instructor" };

const access = signAccessToken(user);
console.log("Access role:", verifyAccessToken(access).role);

const r1 = signRefreshToken(user);
const r2 = signRefreshToken(user);
console.log("Refresh tokens different?", r1 !== r2);
console.log("Refresh sub matches?", verifyRefreshToken(r1).sub === user._id.toString());
console.log("Hash length:", hashToken(r1).length);

try {
  verifyAccessToken(r1);
  console.log("Wrong secret rejected: false");
} catch {
  console.log("Wrong secret rejected: true");
}