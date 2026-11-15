export type Role = "student" | "instructor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CourseCard {
  _id: string;
  title: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: number;
  thumbnail?: { url: string };
  instructor: { _id: string; name: string } | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
}

export interface CourseList {
  courses: CourseCard[];
  pagination: Pagination;
}

export interface Category {
  category: string;
  count: number;
}

export interface Lesson {
  _id: string;
  title: string;
  type: "video" | "text";
  durationMinutes: number;
  order: number;
}

export interface Section {
  _id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseDetail {
  _id: string;
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: number;
  thumbnail?: { url: string };
  instructor: { _id: string; name: string } | null;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
  totalLessons: number;
  totalDurationMinutes: number;
}

export interface ReviewItem {
  _id: string;
  rating: number;
  comment: string;
  createdAt: string;
  student: { name: string };
}

export interface ReviewList {
  reviews: ReviewItem[];
  summary: {
    averageRating: number;
    reviewCount: number;
    distribution: Record<string, number>;
  };
  pagination: Pagination;
}

// ---------- 10d: student ke pages ----------

export interface Attachment {
  _id: string;
  name: string;
  url: string;
  resourceType?: string;
  bytes?: number;
}

export interface LearnLesson {
  _id: string;
  title: string;
  type: "video" | "text";
  content: string;
  durationMinutes: number;
  order: number;
  attachments: Attachment[];
}

export interface LearnSection {
  _id: string;
  title: string;
  order: number;
  lessons: LearnLesson[];
}

export interface LearnCourse {
  _id: string;
  title: string;
  instructor: { _id: string; name: string } | null;
  sections: LearnSection[];
  totalDurationMinutes: number;
}

export interface Progress {
  totalLessons: number;
  completedCount: number;
  progressPercent: number;
  lastLesson: string | null;
  completedAt: string | null;
  certificateId: string | null;
}

export interface LearnProgress extends Progress {
  completedLessons: string[];
  resumeLessonId: string | null;
}

export interface MyEnrollment extends Progress {
  id: string;
  course: string;
  completedLessons: string[];
}

export interface EnrollmentRow {
  _id: string;
  createdAt: string;
  completedAt?: string;
  certificateId?: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  course: {
    _id: string;
    title: string;
    category: string;
    level: string;
    thumbnail?: { url: string };
  };
}

export interface MyReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateData {
  certificateId: string;
  studentName: string;
  courseTitle: string;
  instructorName: string | null;
  completedAt: string;
}

export type CourseStatus = "draft" | "submitted" | "approved" | "rejected";

export interface InstructorOverview {
  courses: { draft: number; submitted: number; approved: number; rejected: number; total: number };
  students: number;
  enrollments: number;
  revenue: number;
  completedEnrollments: number;
  completionRate: number;
  averageRating: number;
  totalReviews: number;
}

export interface InstructorCourseRow {
  _id: string;
  title: string;
  status: CourseStatus;
  price: number;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  students: number;
  revenue: number;
  completed: number;
  completionRate: number;
}

export interface MonthPoint {
  month: string;
  enrollments: number;
  revenue: number;
  newUsers?: number;
}

export interface EditorLesson {
  _id: string;
  title: string;
  type: "video" | "text";
  content: string;
  durationMinutes: number;
  order: number;
  attachments: Attachment[];
}

export interface EditorSection {
  _id: string;
  title: string;
  order: number;
  lessons: EditorLesson[];
}

export interface EditorCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: number;
  status: CourseStatus;
  rejectionReason?: string;
  thumbnail?: { url: string };
  sections: EditorSection[];
}

export interface AdminReviewCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: number;
  status: CourseStatus;
  rejectionReason?: string;
  thumbnail?: { url: string };
  instructor: { _id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string; // yahan "id" hai, "_id" nahi (backend ke shape() se)
  name: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserList {
  users: AdminUser[];
  pagination: Pagination;
}

export interface AdminOverview {
  users: { student: number; instructor: number; admin: number; total: number; newLast30Days: number };
  courses: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    total: number;
    pendingReview: number;
  };
  enrollments: { total: number; last30Days: number; completed: number; completionRate: number };
  revenue: { total: number; last30Days: number };
  ratings: { averageRating: number; totalReviews: number };
}

export interface TopCourseRow {
  _id: string;
  title: string;
  category: string;
  price: number;
  averageRating: number;
  reviewCount: number;
  enrollments: number;
  revenue: number;
  instructorName: string | null;
}

export interface TopInstructorRow {
  instructorId: string;
  name: string | null;
  enrollments: number;
  revenue: number;
  coursesWithEnrollments: number;
}