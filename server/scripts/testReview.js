import "dotenv/config";
import mongoose from "mongoose";
import Review from "../models/Review.js";

await mongoose.connect(process.env.MONGO_URI);
await Review.init(); // unique index pehle ban jaye

const student = new mongoose.Types.ObjectId();
const course = new mongoose.Types.ObjectId();

const r = await Review.create({ student, course, rating: 5, comment: "Great" });
console.log("Review saved, rating:", r.rating);

// rating 6 galat hai
try {
  await Review.create({
    student: new mongoose.Types.ObjectId(),
    course,
    rating: 6,
  });
} catch {
  console.log("Rating 6 rejected: true");
}

// same student, same course dobara
try {
  await Review.create({ student, course, rating: 4 });
} catch (err) {
  console.log("Duplicate review rejected:", err.code === 11000);
}

await Review.deleteOne({ _id: r._id });
await mongoose.disconnect();
console.log("Test done");