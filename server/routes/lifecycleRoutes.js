import { Router } from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import loadOwnedCourse from "../middleware/ownership.js";
import {
  submitCourse,
  listForReview,
  approveCourse,
  rejectCourse,
} from "../controllers/lifecycleController.js";

const router = Router();

const instructorOwner = [authenticate, authorize("instructor"), loadOwnedCourse];
const adminOnly = [authenticate, authorize("admin")];

const courseId = param("id").isMongoId().withMessage("Invalid course id");

// instructor: apna course submit
router.post("/courses/:id/submit", ...instructorOwner, submitCourse);

// admin: review
router.get("/admin/courses", ...adminOnly, listForReview);
router.patch("/admin/courses/:id/approve", ...adminOnly, courseId, validate, approveCourse);
router.patch(
  "/admin/courses/:id/reject",
  ...adminOnly,
  courseId,
  [body("reason").trim().notEmpty().withMessage("Rejection reason is required").isLength({ max: 500 })],
  validate,
  rejectCourse
);

export default router;