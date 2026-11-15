import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { enroll, myEnrollments } from "../controllers/enrollmentController.js";

const router = Router();

const studentOnly = [authenticate, authorize("student")];

router.post("/courses/:id/enroll", ...studentOnly, enroll);
router.get("/enrollments/mine", ...studentOnly, myEnrollments);

export default router;