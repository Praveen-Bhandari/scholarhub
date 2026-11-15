import { Router } from "express";
import { query } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  overview,
  courses,
  monthly,
} from "../controllers/instructorAnalyticsController.js";

const router = Router();

const guard = [authenticate, authorize("instructor")];

router.get("/overview", ...guard, overview);
router.get("/courses", ...guard, courses);

router.get(
  "/monthly",
  ...guard,
  query("months")
    .optional()
    .custom((v) => typeof v === "string")
    .withMessage("months must be a single value")
    .bail()
    .isInt({ min: 1, max: 24 })
    .withMessage("months must be between 1 and 24"),
  validate,
  monthly
);

export default router;