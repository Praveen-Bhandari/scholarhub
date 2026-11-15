import "dotenv/config";
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";

await mongoose.connect(process.env.MONGO_URI);
await Enrollment.init(); // unique index pehle ban jaye, tabhi duplicate test sahi chalega

const student = new mongoose.Types.ObjectId();
const course = new mongoose.Types.ObjectId();
const lesson = new mongoose.Types.ObjectId();

const e = await Enrollment.create({ student, course });
console.log("Enrolled:", !!e._id);
console.log("Completed lessons (default):", e.completedLessons.length);

e.completedLessons.push(lesson);
await e.save();
console.log("After progress:", e.completedLessons.length);

// same student, same course dobara
try {
  await Enrollment.create({ student, course });
} catch (err) {
  console.log("Duplicate enrollment rejected:", err.code === 11000);
}

await Enrollment.deleteOne({ _id: e._id });
await mongoose.disconnect();
console.log("Test done");