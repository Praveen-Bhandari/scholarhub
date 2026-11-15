import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

// ---------- Enroll ----------
export async function enroll(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  // draft ya submitted course ka pata hi nahi chalna chahiye
  const course = await Course.findOne({ _id: id, status: "approved" }).select("price");
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  try {
    const enrollment = await Enrollment.create({
      student: req.user.id, // body se kabhi nahi
      course: id,
      pricePaid: course.price, // us waqt ki price (baad me badle to revenue na badle)
    });
    res.status(201).json({
      enrollment: {
        id: enrollment._id,
        course: id,
        createdAt: enrollment.createdAt,
      },
    });
  } catch (err) {
    // unique index (student + course) ne dobara enroll hone se roka
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "You are already enrolled in this course" });
    }
    throw err;
  }
}

// ---------- Meri enrollments (aggregation pipeline) ----------
export async function myEnrollments(req, res) {
  const enrollments = await Enrollment.aggregate([
    // aggregate me mongoose khud ID cast nahi karta, isliye ObjectId banate hain
    { $match: { student: new mongoose.Types.ObjectId(req.user.id) } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: 100 },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "course",
      },
    },
    { $unwind: "$course" },
    {
      $addFields: {
        // har section ke lessons ginke jodo
        totalLessons: {
          $sum: {
            $map: {
              input: "$course.sections",
              as: "s",
              in: { $size: "$$s.lessons" },
            },
          },
        },
        completedCount: { $size: "$completedLessons" },
      },
    },
    {
      $project: {
        createdAt: 1,
        completedAt: 1,
        certificateId: 1,
        lastLesson: 1,
        completedCount: 1,
        totalLessons: 1,
        progressPercent: {
          $cond: [
            { $gt: ["$totalLessons", 0] },
            {
              $min: [
                100,
                {
                  $round: [
                    { $multiply: [{ $divide: ["$completedCount", "$totalLessons"] }, 100] },
                    0,
                  ],
                },
              ],
            },
            0,
          ],
        },
        "course._id": 1,
        "course.title": 1,
        "course.category": 1,
        "course.level": 1,
        "course.thumbnail": 1,
      },
    },
  ]);

  res.json({ enrollments });
}