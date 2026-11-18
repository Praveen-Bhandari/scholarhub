import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import lifecycleRoutes from "./routes/lifecycleRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import learnRoutes from "./routes/learnRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import instructorAnalyticsRoutes from "./routes/instructorAnalyticsRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import { apiLimiter } from "./middleware/rateLimiters.js";

const app = express();

// deploy par (Render wagairah) proxy ke peeche asli IP padhne ke liye
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) =>
  res.json({ name: "ScholarHub API", status: "ok", health: "/api/health", courses: "/api/courses" })
);

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/courses", contentRoutes);
app.use("/api/courses", uploadRoutes);
app.use("/api/courses", publicRoutes);
app.use("/api", lifecycleRoutes);
app.use("/api", enrollmentRoutes);
app.use("/api", learnRoutes);
app.use("/api", certificateRoutes);
app.use("/api", reviewRoutes);
app.use("/api/analytics/instructor", instructorAnalyticsRoutes);
app.use("/api/analytics/admin", adminAnalyticsRoutes);
app.use("/api/admin/users", adminUserRoutes);


app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});