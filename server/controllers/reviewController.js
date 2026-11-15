import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Review from "../models/Review.js";

const shape = (r) => ({
  id: r._id,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

// aggregation se average aur ginti nikalke course me save
async function recalcRating(courseId) {
  const [stats] = await Review.aggregate([
    { $match: { course: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await Course.updateOne(
    { _id: courseId },
    {
      averageRating: stats ? Math.round(stats.average * 10) / 10 : 0,
      reviewCount: stats ? stats.count : 0,
    }
  );
}

// approved course ho aur student enrolled ho
async function checkCanReview(req, res) {
  const { id } = req.params;

  if (!(await Course.exists({ _id: id, status: "approved" }))) {
    res.status(404).json({ message: "Course not found" });
    return false;
  }
  if (!(await Enrollment.exists({ student: req.user.id, course: id }))) {
    res
      .status(403)
      .json({ message: "Only enrolled students can review this course" });
    return false;
  }
  return true;
}

// ---------- Review likho ----------
export async function createReview(req, res) {
  if (!(await checkCanReview(req, res))) return;

  let review;
  try {
    review = await Review.create({
      student: req.user.id, // body se kabhi nahi
      course: req.params.id,
      rating: req.body.rating,
      comment: req.body.comment,
    });
  } catch (err) {
    // unique index (student + course)
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "You have already reviewed this course" });
    }
    throw err;
  }

  await recalcRating(req.params.id);
  res.status(201).json({ review: shape(review) });
}

// ---------- Apna review dekho ----------
export async function getMyReview(req, res) {
  const review = await Review.findOne({
    student: req.user.id,
    course: req.params.id,
  });
  if (!review) {
    return res.status(404).json({ message: "You have not reviewed this course" });
  }
  res.json({ review: shape(review) });
}

// ---------- Apna review badlo ----------
export async function updateReview(req, res) {
  const { rating, comment } = req.body;
  if (rating === undefined && comment === undefined) {
    return res.status(400).json({ message: "Send a rating or a comment to update" });
  }

  const review = await Review.findOne({
    student: req.user.id,
    course: req.params.id,
  });
  if (!review) {
    return res.status(404).json({ message: "You have not reviewed this course" });
  }

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  await review.save();

  await recalcRating(req.params.id);
  res.json({ review: shape(review) });
}

// ---------- Apna review hatao ----------
export async function deleteReview(req, res) {
  const result = await Review.deleteOne({
    student: req.user.id,
    course: req.params.id,
  });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "You have not reviewed this course" });
  }

  await recalcRating(req.params.id);
  res.json({ message: "Review deleted" });
}

// ---------- Public list + summary ----------
export async function listReviews(req, res) {
  const { id } = req.params;

  if (!(await Course.exists({ _id: id, status: "approved" }))) {
    return res.status(404).json({ message: "Course not found" });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [reviews, aggregated] = await Promise.all([
    Review.find({ course: id })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("student", "name") // sirf naam, email nahi
      .lean(),
    // $facet: ek hi pass me average, ginti aur har star ki ginti
    Review.aggregate([
      { $match: { course: new mongoose.Types.ObjectId(id) } },
      {
        $facet: {
          overall: [
            { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
          ],
          distribution: [{ $group: { _id: "$rating", count: { $sum: 1 } } }],
        },
      },
    ]),
  ]);

  const stats = aggregated[0];
  const overall = stats.overall[0];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of stats.distribution) distribution[d._id] = d.count;

  const total = overall ? overall.count : 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    reviews: reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      student: { name: r.student?.name || "Former student" },
    })),
    summary: {
      averageRating: overall ? Math.round(overall.average * 10) / 10 : 0,
      reviewCount: total,
      distribution,
    },
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages },
  });
}