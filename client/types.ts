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