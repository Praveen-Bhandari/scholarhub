import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
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
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId }],
    lastLesson: { type: mongoose.Schema.Types.ObjectId }, // resume ke liye
    completedAt: { type: Date },
    certificateId: { type: String },
    pricePaid: { type: Number, default: 0, min: 0 }, // enroll ke waqt ki price
  },
  { timestamps: true }
);

// ek student ek course me sirf ek baar enroll ho sakta hai
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// instructor analytics: "is course ke kitne students"
enrollmentSchema.index({ course: 1 });

// certificate ID unique (jinke paas nahi hai unhe ye rule nahi lagta)
enrollmentSchema.index({ certificateId: 1 }, { unique: true, sparse: true });

// instructor analytics: course ke hisaab se, mahine ke range ke saath
enrollmentSchema.index({ course: 1, createdAt: 1 });

export default mongoose.model("Enrollment", enrollmentSchema);