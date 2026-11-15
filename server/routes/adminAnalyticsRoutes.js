import { Router } from "express";
import { query } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  overview,
  topCoursesList,
  topInstructorsList,
  monthly,
} from "../controllers/adminAnalyticsController.js";

const router = Router();

const guard = [authenticate, authorize("admin")];

const single = (name) =>
  query(name)
    .optional()
    .custom((v) => typeof v === "string")
    .withMessage(`${name} must be a single value`)
    .bail();

router.get("/overview", ...guard, overview);

router.get(
  "/top-courses",
  ...guard,
  single("by").isIn(["enrollments", "revenue", "rating"]).withMessage("by must be enrollments, revenue or rating"),
  single("limit").isInt({ min: 1, max: 20 }).withMessage("limit must be between 1 and 20"),
  validate,
  topCoursesList
);

router.get(
  "/top-instructors",
  ...guard,
  single("limit").isInt({ min: 1, max: 20 }).withMessage("limit must be between 1 and 20"),
  validate,
  topInstructorsList
);

router.get(
  "/monthly",
  ...guard,
  single("months").isInt({ min: 1, max: 24 }).withMessage("months must be between 1 and 24"),
  validate,
  monthly
);

export default router;