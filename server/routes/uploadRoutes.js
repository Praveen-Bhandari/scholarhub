import { Router } from "express";
import { param } from "express-validator";
import validate from "../middleware/validate.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import loadOwnedCourse from "../middleware/ownership.js";
import loadLesson from "../middleware/loadLesson.js";
import {
  uploadSingle,
  IMAGE_TYPES,
  ATTACHMENT_TYPES,
} from "../middleware/upload.js";
import {
  setThumbnail,
  removeThumbnail,
  addAttachment,
  removeAttachment,
} from "../controllers/uploadController.js";

const router = Router();

// pehle login, role, ownership; file uske baad padhi jayegi
const guard = [authenticate, authorize("instructor"), loadOwnedCourse];

const lessonIds = [
  param("sectionId").isMongoId().withMessage("Invalid section id"),
  param("lessonId").isMongoId().withMessage("Invalid lesson id"),
];
const attachmentId = param("attachmentId")
  .isMongoId()
  .withMessage("Invalid attachment id");

const thumbnailUpload = uploadSingle({
  field: "thumbnail",
  allowedTypes: IMAGE_TYPES,
  maxBytes: 2 * 1024 * 1024, // 2 MB
});

const attachmentUpload = uploadSingle({
  field: "file",
  allowedTypes: ATTACHMENT_TYPES,
  maxBytes: 10 * 1024 * 1024, // 10 MB
});

// thumbnail
router.put("/:id/thumbnail", ...guard, thumbnailUpload, setThumbnail);
router.delete("/:id/thumbnail", ...guard, removeThumbnail);

// lesson attachments
const attachmentsPath = "/:id/sections/:sectionId/lessons/:lessonId/attachments";

router.post(
  attachmentsPath,
  ...guard,
  ...lessonIds,
  validate,
  loadLesson,
  attachmentUpload,
  addAttachment
);

router.delete(
  `${attachmentsPath}/:attachmentId`,
  ...guard,
  ...lessonIds,
  attachmentId,
  validate,
  loadLesson,
  removeAttachment
);

export default router;