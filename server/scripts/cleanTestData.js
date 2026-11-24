import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import RefreshToken from "../models/RefreshToken.js";
import Review from "../models/Review.js";
import User from "../models/User.js";

const all = process.argv.includes("--all");

const TEST_TITLES =
  /^(Zenroll|Zlearn|Zcert|Zreview|Zlisting|Zdetail|Zadmin|Zanalytics|RBAC Fixture|Upload Fixture|Attachment Fixture)/;
const TEST_USERS = /^(zuser|zadmin|zauth)/;

await mongoose.connect(process.env.MONGO_URI);

const filter = { $or: [{ title: TEST_TITLES }] };
if (all) {
  const owners = await User.find({
    email: { $in: ["instructor1@example.com", "instructor2@example.com", "instructor3@example.com"] },
  }).select("_id");
  filter.$or.push({ instructor: { $in: owners.map((o) => o._id) } });
}

const courseIds = await Course.distinct("_id", filter);
const users = await User.find({ email: TEST_USERS }).select("_id");
const userIds = users.map((u) => u._id);

const scope = { $or: [{ course: { $in: courseIds } }, { student: { $in: userIds } }] };
const [reviews, enrollments] = await Promise.all([
  Review.deleteMany(scope),
  Enrollment.deleteMany(scope),
]);
await RefreshToken.deleteMany({ user: { $in: userIds } });
const courses = await Course.deleteMany({ _id: { $in: courseIds } });
const removedUsers = await User.deleteMany({ _id: { $in: userIds } });

console.log(
  `Removed: ${courses.deletedCount} courses, ${enrollments.deletedCount} enrollments, ` +
    `${reviews.deletedCount} reviews, ${removedUsers.deletedCount} test users.`
);

await mongoose.disconnect();
