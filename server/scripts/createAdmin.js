import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.log("Usage: node scripts/createAdmin.js <email> <password>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) {
  console.log("User already exists with role:", existing.role);
} else {
  await User.create({
    name: "Platform Admin",
    email,
    password,
    role: "admin",
    isEmailVerified: true, // email nahi bhejni, seedha verified
  });
  console.log("Admin created:", email);
}

await mongoose.disconnect();