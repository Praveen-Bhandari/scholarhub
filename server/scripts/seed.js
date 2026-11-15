import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import RefreshToken from "../models/RefreshToken.js";
import Review from "../models/Review.js";
import User from "../models/User.js";

const DOMAIN = "seed.scholarhub.test";
const EMAIL_RE = /@seed\.scholarhub\.test$/;
const PASSWORD = "Seed@12345";
const DAY = 24 * 60 * 60 * 1000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ---------- Options ----------
function parseArgs(argv) {
  const opts = { courses: 60, students: 40, instructors: 6, seed: 42, reset: false, clean: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--reset") opts.reset = true;
    else if (arg === "--clean") opts.clean = true;
    else if (["--courses", "--students", "--instructors", "--seed"].includes(arg)) {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) fail(`${arg} needs a whole number`);
      opts[arg.slice(2)] = n;
    } else {
      fail(
        `Unknown option: ${arg}\n` +
          "Usage: node scripts/seed.js [--courses N] [--students N] [--instructors N] [--seed N] [--reset] [--clean]"
      );
    }
  }
  if (opts.courses < 1 || opts.courses > 50000) fail("--courses must be between 1 and 50000");
  if (opts.students > 50000) fail("--students can be at most 50000");
  if (opts.instructors < 1 || opts.instructors > 500) fail("--instructors must be between 1 and 500");
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(opts.seed);
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function weighted(pairs) {
  const total = pairs.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [value, weight] of pairs) {
    r -= weight;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Ananya", "Diya", "Meera", "Saanvi", "Riya", "Rohan", "Neha"];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Iyer", "Nair", "Reddy", "Khan", "Mehta", "Joshi", "Das"];

const CATALOG = {
  web: ["React", "Node.js", "Next.js", "TypeScript", "MongoDB"],
  mobile: ["Flutter", "Android", "React Native", "iOS"],
  data: ["Python", "SQL", "Machine Learning", "Data Science", "Excel"],
  design: ["Figma", "UI Design", "UX Research", "Photoshop"],
  devops: ["Docker", "Kubernetes", "Git and GitHub", "Linux"],
  security: ["Cyber Security", "Ethical Hacking", "Network Security"],
  business: ["Digital Marketing", "Product Management", "Public Speaking", "Finance"],
};
const CATEGORIES = Object.keys(CATALOG);
const MODIFIERS = ["Complete Guide", "Masterclass", "Bootcamp", "Crash Course", "Fundamentals", "Advanced Techniques", "for Beginners", "Hands-on Projects"];
const SECTION_TITLES = ["Introduction", "Getting Started", "Core Concepts", "Advanced Topics"];
const REJECT_REASONS = ["Add more lessons", "Description is too short", "Course content needs improvement"];
const COMMENTS = {
  5: ["Excellent course, very clear.", "Loved every lesson.", "Best course on this topic."],
  4: ["Very good, learned a lot.", "Good pace and examples.", "Solid course."],
  3: ["Decent, could use more examples.", "Okay for the price."],
  2: ["Too fast for beginners.", "Needs better explanations."],
  1: ["Not what I expected.", "Outdated content."],
};
const ENROLL_COUNTS = [[0, 15], [1, 20], [2, 20], [3, 15], [4, 10], [5, 8], [6, 6], [8, 4], [10, 2]];

// ---------- Helpers ----------
async function insertInBatches(Model, docs, label, size = 500) {
  for (let i = 0; i < docs.length; i += size) {
    await Model.insertMany(docs.slice(i, i + size));
    process.stdout.write(`\r${label}: ${Math.min(i + size, docs.length)} / ${docs.length}`);
  }
  if (docs.length) process.stdout.write("\n");
}

async function removeSeedData() {
  const users = await User.find({ email: EMAIL_RE }).select("_id");
  if (users.length === 0) return 0;

  const userIds = users.map((u) => u._id);
  const courseIds = await Course.distinct("_id", { instructor: { $in: userIds } });

  await Promise.all([
    Review.deleteMany({ $or: [{ course: { $in: courseIds } }, { student: { $in: userIds } }] }),
    Enrollment.deleteMany({ $or: [{ course: { $in: courseIds } }, { student: { $in: userIds } }] }),
    RefreshToken.deleteMany({ user: { $in: userIds } }),
  ]);
  await Course.deleteMany({ _id: { $in: courseIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  return users.length;
}

// ------------------------------------------------------------------
const started = Date.now();
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User, Course, Enrollment, Review, RefreshToken].map((M) => M.init())); 

const existing = await User.countDocuments({ email: EMAIL_RE });
if (existing > 0 && !opts.reset && !opts.clean) {
  fail("Seed data already exists. Use --reset to recreate it, or --clean to remove it.");
}
if (existing > 0) {
  console.log(`Removing old seed data (${await removeSeedData()} users and their courses)...`);
}
if (opts.clean) {
  await mongoose.disconnect();
  console.log("Seed data removed.");
  process.exit(0);
}

const now = Date.now();
const when = (maxDays) => new Date(now - Math.floor(rand() * maxDays * DAY));

// ---------- Users ----------
console.log("Hashing the password once (all seed users share it)...");
const hash = await bcrypt.hash(PASSWORD, 12);

const mkUser = (name, email, role, createdAt) => ({
  _id: new mongoose.Types.ObjectId(),
  name,
  email,
  password: hash, 
  role,
  isEmailVerified: true,
  isActive: true,
  createdAt,
  updatedAt: createdAt,
});

const admin = mkUser("Seed Admin", `admin@${DOMAIN}`, "admin", new Date(now - 400 * DAY));
const instructors = Array.from({ length: opts.instructors }, (_, i) =>
  mkUser(`${pick(FIRST)} ${pick(LAST)}`, `instructor${i + 1}@${DOMAIN}`, "instructor", when(380))
);
const students = Array.from({ length: opts.students }, (_, i) =>
  mkUser(`${pick(FIRST)} ${pick(LAST)}`, `student${i + 1}@${DOMAIN}`, "student", when(360))
);

// ---------- Courses ----------
const usedTitles = new Set();
const courses = [];
const approved = []; 
const statusCount = { approved: 0, submitted: 0, draft: 0, rejected: 0 };

for (let i = 0; i < opts.courses; i++) {
  const category = pick(CATEGORIES);
  const topic = pick(CATALOG[category]);
  let title = `${topic} ${pick(MODIFIERS)}`;
  if (usedTitles.has(title)) title = `${title} ${i + 1}`;
  usedTitles.add(title);

  const status = weighted([["approved", 80], ["submitted", 8], ["draft", 8], ["rejected", 4]]);
  statusCount[status] += 1;
  const createdAt = when(365);

  const lessonIds = [];
  const sections = [];
  const sectionCount = int(2, 4);
  for (let s = 0; s < sectionCount; s++) {
    const lessons = [];
    const lessonCount = int(2, 5);
    for (let l = 0; l < lessonCount; l++) {
      const _id = new mongoose.Types.ObjectId();
      lessonIds.push(_id);
      const isVideo = rand() < 0.6;
      lessons.push({
        _id,
        title: `Lesson ${l + 1}: ${topic} part ${s * 5 + l + 1}`,
        type: isVideo ? "video" : "text",
        content: isVideo
          ? `https://example.com/videos/${rand().toString(16).slice(2, 10)}`
          : `Seed notes about ${topic}.`,
        durationMinutes: int(3, 25),
        order: l,
        attachments: [],
      });
    }
    sections.push({ _id: new mongoose.Types.ObjectId(), title: SECTION_TITLES[s], order: s, lessons });
  }

  const _id = new mongoose.Types.ObjectId();
  const price = weighted([[0, 15], [199, 15], [499, 25], [999, 20], [1499, 15], [2999, 7], [4999, 3]]);

  courses.push({
    _id,
    title,
    description: `Learn ${topic} step by step with practical examples and real projects. ` +
      `This ${category} course takes you from the basics to confident, job-ready skills.`,
    category,
    level: pick(["beginner", "intermediate", "advanced"]),
    price,
    instructor: pick(instructors)._id,
    status,
    rejectionReason: status === "rejected" ? pick(REJECT_REASONS) : "",
    sections,
    averageRating: 0,
    reviewCount: 0,
    createdAt,
    updatedAt: createdAt,
  });

  if (status === "approved") approved.push({ _id, price, createdAt, lessonIds });
}

const enrollments = [];
const reviews = [];
const certIds = new Set();
const nextCertificate = () => {
  let id;
  do {
    id = "SH-" + Array.from({ length: 10 }, () => "0123456789ABCDEF"[int(0, 15)]).join("");
  } while (certIds.has(id));
  certIds.add(id);
  return id;
};

if (approved.length > 0) {
  for (const student of students) {
    const want = Math.min(weighted(ENROLL_COUNTS), approved.length);
    const chosen = new Set();
    while (chosen.size < want) chosen.add(int(0, approved.length - 1)); // ek student, ek course, ek baar

    for (const index of chosen) {
      const course = approved[index];
      const from = Math.max(student.createdAt.getTime(), course.createdAt.getTime());
      const enrolledAt = new Date(from + Math.floor(rand() * (now - from)));

      const e = {
        student: student._id,
        course: course._id,
        completedLessons: [],
        pricePaid: course.price, 
        createdAt: enrolledAt,
        updatedAt: enrolledAt,
      };

      const state = weighted([["done", 25], ["partial", 45], ["none", 30]]);
      if (state === "done") {
        e.completedLessons = course.lessonIds;
        e.lastLesson = course.lessonIds[course.lessonIds.length - 1];
        e.completedAt = new Date(Math.min(now, enrolledAt.getTime() + int(1, 30) * DAY));
        e.certificateId = nextCertificate();
      } else if (state === "partial") {
        const k = int(1, Math.max(1, course.lessonIds.length - 1));
        e.completedLessons = course.lessonIds.slice(0, k);
        e.lastLesson = course.lessonIds[k - 1];
      }
      enrollments.push(e);

      if (state !== "none" && rand() < 0.55) {
        const rating = weighted([[5, 40], [4, 35], [3, 15], [2, 6], [1, 4]]);
        const reviewedAt = new Date(Math.min(now, enrolledAt.getTime() + int(1, 60) * DAY));
        reviews.push({
          student: student._id,
          course: course._id,
          rating,
          comment: pick(COMMENTS[rating]),
          createdAt: reviewedAt,
          updatedAt: reviewedAt,
        });
      }
    }
  }
}

await insertInBatches(User, [admin, ...instructors, ...students], "Users");
await insertInBatches(Course, courses, "Courses");
await insertInBatches(Enrollment, enrollments, "Enrollments");
await insertInBatches(Review, reviews, "Reviews");

const ratingRows = await Review.aggregate([
  { $match: { course: { $in: approved.map((c) => c._id) } } },
  {
    $group: {
      _id: "$course",
      average: { $avg: "$rating" },
      count: { $sum: 1 },
    },
  },
  { $project: { average: { $round: ["$average", 1] }, count: 1 } },
]);
for (let i = 0; i < ratingRows.length; i += 500) {
  await Course.bulkWrite(
    ratingRows.slice(i, i + 500).map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { averageRating: r.average, reviewCount: r.count } },
      },
    }))
  );
}

// ---------- Summary ----------
const completed = enrollments.filter((e) => e.completedAt).length;
console.log("\nSeed done in " + ((Date.now() - started) / 1000).toFixed(1) + " seconds");
console.log(`Users:       1 admin, ${instructors.length} instructors, ${students.length} students`);
console.log(
  `Courses:     ${courses.length} (approved ${statusCount.approved}, submitted ${statusCount.submitted}, ` +
    `draft ${statusCount.draft}, rejected ${statusCount.rejected})`
);
console.log(`Enrollments: ${enrollments.length} (completed ${completed})`);
console.log(`Reviews:     ${reviews.length}`);
console.log(`\nDemo logins (password ${PASSWORD}):`);
console.log(`  admin@${DOMAIN}`);
console.log(`  instructor1@${DOMAIN}`);
if (students.length > 0) console.log(`  student1@${DOMAIN}`);

await mongoose.disconnect();