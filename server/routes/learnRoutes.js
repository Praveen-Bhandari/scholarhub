import { Router } from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  getLearnCourse,
  getMyEnrollment,
  completeLesson,
  uncompleteLesson,
  setLastLesson,
} from "../controllers/learnController.js";

const router = Router();

const studentOnly = [authenticate, authorize("student")];

const courseId = param("courseId").isMongoId().withMessage("Invalid course id");
const lessonId = param("lessonId").isMongoId().withMessage("Invalid lesson id");

router.get(
  "/learn/courses/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid course id"),
  validate,
  getLearnCourse
);

router.get("/enrollments/:courseId", ...studentOnly, courseId, validate, getMyEnrollment);

router.post(
  "/enrollments/:courseId/lessons/:lessonId/complete",
  ...studentOnly,
  courseId,
  lessonId,
  validate,
  completeLesson
);
router.delete(
  "/enrollments/:courseId/lessons/:lessonId/complete",
  ...studentOnly,
  courseId,
  lessonId,
  validate,
  uncompleteLesson
);

router.put(
  "/enrollments/:courseId/last-lesson",
  ...studentOnly,
  courseId,
  body("lessonId").isMongoId().withMessage("Valid lessonId is required"),
  validate,
  setLastLesson
);

export default router;