import { Router } from "express";
import { param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import {
  getMyCertificate,
  verifyCertificate,
} from "../controllers/certificateController.js";

const router = Router();

router.get(
  "/enrollments/:courseId/certificate",
  authenticate,
  authorize("student"),
  param("courseId").isMongoId().withMessage("Invalid course id"),
  validate,
  getMyCertificate
);

// public: login nahi chahiye
router.get(
  "/certificates/:certificateId",
  param("certificateId")
    .matches(/^SH-[0-9A-F]{10}$/i)
    .withMessage("Invalid certificate id"),
  validate,
  verifyCertificate
);

export default router;