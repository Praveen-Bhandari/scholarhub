import { Router } from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import loadOwnedCourse from "../middleware/ownership.js";
import {
  createCourse,
  getMyCourses,
  getMyCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";

const router = Router();

// in routes par login + instructor role dono chahiye
const instructorOnly = [authenticate, authorize("instructor")];

const createRules = [
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 120 }),
  body("description").trim().notEmpty().withMessage("Description is required").isLength({ max: 5000 }),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("level").optional().isIn(["beginner", "intermediate", "advanced"]),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be 0 or more"),
];

const updateRules = [
  body("title").optional().trim().notEmpty().isLength({ max: 120 }),
  body("description").optional().trim().notEmpty().isLength({ max: 5000 }),
  body("category").optional().trim().notEmpty(),
  body("level").optional().isIn(["beginner", "intermediate", "advanced"]),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be 0 or more"),
];

router.post("/", instructorOnly, createRules, validate, createCourse);

// "/mine" ko "/:id" se pehle rakhna zaroori hai
router.get("/mine", instructorOnly, getMyCourses);
router.get("/mine/:id", instructorOnly, loadOwnedCourse, getMyCourse);

router.put("/:id", instructorOnly, loadOwnedCourse, updateRules, validate, updateCourse);
router.delete("/:id", instructorOnly, loadOwnedCourse, deleteCourse);

export default router;