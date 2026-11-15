import { Router } from "express";
import { query } from "express-validator";
import validate from "../middleware/validate.js";
import {
  listCourses,
  getCourse,
  listCategories,
} from "../controllers/publicController.js";

const router = Router();

const singles = [
  "q", "category", "level", "minPrice", "maxPrice", "minRating", "sort", "page", "limit",
].map((name) =>
  query(name)
    .optional()
    .custom((v) => typeof v === "string")
    .withMessage(`${name} must be a single value`)
);

const listRules = [
  ...singles,
  query("q").optional().isLength({ max: 100 }),
  query("category").optional().isLength({ min: 1, max: 60 }),
  query("level").optional().isIn(["beginner", "intermediate", "advanced"]),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("minRating").optional().isFloat({ min: 0, max: 5 }),
  query("sort").optional().isIn(["newest", "oldest", "price_asc", "price_desc", "rating"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

router.get("/", listRules, validate, listCourses);

router.get("/categories", listCategories);
router.get("/:id", getCourse);

export default router;