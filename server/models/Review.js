import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

// ek student ek course ka ek hi review de sakta hai
reviewSchema.index({ student: 1, course: 1 }, { unique: true });

// course ke reviews, naye pehle
reviewSchema.index({ course: 1, createdAt: -1, _id: -1 });

export default mongoose.model("Review", reviewSchema);