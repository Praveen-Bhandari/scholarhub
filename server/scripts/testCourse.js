import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";

await mongoose.connect(process.env.MONGO_URI);

const u = await User.create({
  name: "Test Instructor",
  email: "test-instructor@example.com",
  password: "password123",
  role: "instructor",
});

const c = await Course.create({
  title: "Test Course",
  description: "demo",
  category: "web",
  instructor: u._id,
  sections: [{ title: "Intro", lessons: [{ title: "Welcome" }] }],
});

console.log("Status (default):", c.status);
console.log("Owner matches:", c.instructor.equals(u._id));
console.log("Lesson title:", c.sections[0].lessons[0].title);

// bina instructor ke course nahi banna chahiye
try {
  await Course.create({ title: "x", description: "y", category: "z" });
} catch {
  console.log("No-instructor course rejected: true");
}

await Course.deleteOne({ _id: c._id });
await User.deleteOne({ _id: u._id });
await mongoose.disconnect();
console.log("Test done");