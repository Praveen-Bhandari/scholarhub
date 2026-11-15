import { Router } from "express";
import { body, param, query } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { listUsers, updateUser } from "../controllers/adminUserController.js";

const router = Router();

const guard = [authenticate, authorize("admin")];

// har param sirf ek value ho (?role=a&role=b galat)
const single = (name) =>
  query(name)
    .optional()
    .custom((v) => typeof v === "string")
    .withMessage(`${name} must be a single value`)
    .bail();

const listRules = [
  single("q").isLength({ max: 100 }),
  single("role").isIn(["student", "instructor", "admin"]),
  single("status").isIn(["active", "inactive"]),
  single("page").isInt({ min: 1 }),
  single("limit").isInt({ min: 1, max: 50 }),
];

const updateRules = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("role")
    .optional()
    .isIn(["student", "instructor", "admin"])
    .withMessage("Role must be student, instructor or admin"),
  body("isActive")
    .optional()
    .custom((v) => typeof v === "boolean")
    .withMessage("isActive must be true or false"),
];

router.get("/", ...guard, listRules, validate, listUsers);
router.patch("/:id", ...guard, updateRules, validate, updateUser);

export default router;