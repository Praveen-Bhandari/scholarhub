import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

await mongoose.connect(process.env.MONGO_URI);

const u = await User.create({
  name: "Test User",
  email: "test-user@example.com",
  password: "password123",
});

console.log("Role (default):", u.role);
console.log("Password hashed?", u.password.startsWith("$2"));
console.log("Password match:", await u.comparePassword("password123"));
console.log("Wrong password:", await u.comparePassword("wrongpass"));

await User.deleteOne({ _id: u._id });
await mongoose.disconnect();
console.log("Test done");