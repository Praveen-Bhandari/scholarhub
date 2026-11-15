import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ["video", "text"], default: "text" },
  content: { type: String, default: "" }, 
  durationMinutes: { type: Number, default: 0, min: 0 },
  order: { type: Number, default: 0 },
   attachments: [
    {
      name: String,
      url: String,
      publicId: String, 
      resourceType: String, 
      bytes: Number,
    },
  ],
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  lessons: [lessonSchema],
});

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    price: { type: Number, default: 0, min: 0 },
    thumbnail: { url: String, publicId: String },

    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    rejectionReason: { type: String, default: "" },

    sections: [sectionSchema],

    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseSchema.index({ status: 1, createdAt: -1, _id: -1 }); 
courseSchema.index({ status: 1, price: 1, _id: 1 }); 
courseSchema.index({ status: 1, averageRating: -1, reviewCount: -1, _id: -1 }); 
courseSchema.index({ status: 1, category: 1, createdAt: -1, _id: -1 }); 
courseSchema.index({ title: "text", description: "text" }); 

export default mongoose.model("Course", courseSchema);