import { Router } from "express";
import { body, param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import loadOwnedCourse from "../middleware/ownership.js";
import {
  addSection,
  updateSection,
  deleteSection,
  addLesson,
  updateLesson,
  deleteLesson,
} from "../controllers/contentController.js";

const router = Router();

// login + instructor role + course isi instructor ka ho
const guard = [authenticate, authorize("instructor"), loadOwnedCourse];

const sectionId = param("sectionId").isMongoId().withMessage("Invalid section id");
const lessonId = param("lessonId").isMongoId().withMessage("Invalid lesson id");

const sectionRules = [
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 120 }),
];

const lessonCreateRules = [
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 120 }),
  body("type").optional().isIn(["video", "text"]),
  body("content").optional().isString().isLength({ max: 20000 }),
  body("durationMinutes").optional().isInt({ min: 0 }),
];

const lessonUpdateRules = [
  body("title").optional().trim().notEmpty().isLength({ max: 120 }),
  body("type").optional().isIn(["video", "text"]),
  body("content").optional().isString().isLength({ max: 20000 }),
  body("durationMinutes").optional().isInt({ min: 0 }),
];

router.post("/:id/sections", ...guard, sectionRules, validate, addSection);
router.put("/:id/sections/:sectionId", ...guard, sectionId, sectionRules, validate, updateSection);
router.delete("/:id/sections/:sectionId", ...guard, sectionId, validate, deleteSection);

router.post("/:id/sections/:sectionId/lessons", ...guard, sectionId, lessonCreateRules, validate, addLesson);
router.put("/:id/sections/:sectionId/lessons/:lessonId", ...guard, sectionId, lessonId, lessonUpdateRules, validate, updateLesson);
router.delete("/:id/sections/:sectionId/lessons/:lessonId", ...guard, sectionId, lessonId, validate, deleteLesson);

export default router;