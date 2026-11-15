import crypto from "crypto";
import path from "path";
import { uploadBuffer, deleteFile } from "../services/storage.js";

const MAX_ATTACHMENTS = 5;

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

// submitted course me badlav nahi; rejected me badlav ho to wapas draft
function canEdit(course, res) {
  if (course.status === "submitted") {
    res
      .status(409)
      .json({ message: "Course is under review and cannot be edited" });
    return false;
  }
  if (course.status === "rejected") {
    course.status = "draft";
    course.rejectionReason = "";
  }
  return true;
}

// ---------- Thumbnail ----------
export async function setThumbnail(req, res) {
  const course = req.course; // ownership middleware ne check kar liya
  if (!canEdit(course, res)) return;

  const result = await uploadBuffer(req.file.buffer, {
    folder: `scholarhub/courses/${course._id}`,
    resourceType: "image",
  });

  const oldPublicId = course.thumbnail?.publicId;
  course.thumbnail = { url: result.secure_url, publicId: result.public_id };

  try {
    await course.save();
  } catch (err) {
    // save fail hua to nayi upload ki hui file bekaar na pade
    await deleteFile(result.public_id, "image").catch(() => {});
    throw err;
  }

  // purani thumbnail Cloudinary se hatao
  if (oldPublicId) {
    deleteFile(oldPublicId, "image").catch((e) =>
      console.error("Old thumbnail delete failed:", e.message)
    );
  }

  res.json({ thumbnail: course.thumbnail });
}

export async function removeThumbnail(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  if (!course.thumbnail?.publicId) {
    return res.status(404).json({ message: "Course has no thumbnail" });
  }

  const publicId = course.thumbnail.publicId;
  course.thumbnail = undefined;
  await course.save();

  await deleteFile(publicId, "image").catch((e) =>
    console.error("Thumbnail delete failed:", e.message)
  );

  res.json({ message: "Thumbnail removed" });
}

// ---------- Lesson attachments ----------
export async function addAttachment(req, res) {
  const course = req.course;
  const lesson = req.lesson; // loadLesson middleware ne set kiya
  if (!canEdit(course, res)) return;

  if (lesson.attachments.length >= MAX_ATTACHMENTS) {
    return res.status(409).json({
      message: `A lesson can have at most ${MAX_ATTACHMENTS} attachments`,
    });
  }

  const type = req.file.detectedType; // asli content se pata chala type
  const isImage = type.startsWith("image/");

  // original naam saaf karke public id banao (random hissa jodke)
  const base =
    path
      .parse(req.file.originalname)
      .name.toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file";
  const rand = crypto.randomBytes(4).toString("hex");
  // raw files (pdf, zip) ke public id me extension rehta hai
  const publicId = isImage ? `${base}-${rand}` : `${base}-${rand}.${EXT[type]}`;

  const result = await uploadBuffer(req.file.buffer, {
    folder: `scholarhub/courses/${course._id}/lessons`,
    resourceType: isImage ? "image" : "raw",
    publicId,
  });

  lesson.attachments.push({
    name: req.file.originalname.slice(0, 120),
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    bytes: result.bytes,
  });

  try {
    await course.save();
  } catch (err) {
    await deleteFile(result.public_id, result.resource_type).catch(() => {});
    throw err;
  }

  const attachment = lesson.attachments[lesson.attachments.length - 1];
  res.status(201).json({ attachment });
}

export async function removeAttachment(req, res) {
  const course = req.course;
  const lesson = req.lesson;
  if (!canEdit(course, res)) return;

  const attachment = lesson.attachments.id(req.params.attachmentId);
  if (!attachment) {
    return res.status(404).json({ message: "Attachment not found" });
  }

  const { publicId, resourceType } = attachment;
  lesson.attachments.pull(attachment._id);
  await course.save();

  await deleteFile(publicId, resourceType || "image").catch((e) =>
    console.error("Attachment delete failed:", e.message)
  );

  res.json({ message: "Attachment removed" });
}