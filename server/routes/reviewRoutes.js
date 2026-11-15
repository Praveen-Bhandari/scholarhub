import { Router } from "express";
import { body, param, query } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  createReview,
  getMyReview,
  updateReview,
  deleteReview,
  listReviews,
} from "../controllers/reviewController.js";

const router = Router();

const studentOnly = [authenticate, authorize("student")];
const courseId = param("id").isMongoId().withMessage("Invalid course id");

const isRating = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
const ratingMsg = "Rating must be a whole number from 1 to 5";

const commentRule = body("comment")
  .optional()
  .custom((v) => typeof v === "string")
  .withMessage("Comment must be text")
  .bail()
  .isLength({ max: 1000 })
  .withMessage("Comment can be at most 1000 characters");

const createRules = [body("rating").custom(isRating).withMessage(ratingMsg), commentRule];
const updateRules = [
  body("rating").optional().custom(isRating).withMessage(ratingMsg),
  commentRule,
];

const listRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

// public
router.get("/courses/:id/reviews", courseId, listRules, validate, listReviews);

router.get("/courses/:id/reviews/mine", ...studentOnly, courseId, validate, getMyReview);
router.post("/courses/:id/reviews", ...studentOnly, courseId, createRules, validate, createReview);
router.put("/courses/:id/reviews/mine", ...studentOnly, courseId, updateRules, validate, updateReview);
router.delete("/courses/:id/reviews/mine", ...studentOnly, courseId, validate, deleteReview);

export default router;