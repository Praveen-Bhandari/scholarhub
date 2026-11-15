"use client";

import { useRouter } from "next/navigation";
import CourseForm from "./CourseForm";
import { api } from "@/lib/api";

export default function NewCourseForm() {
  const router = useRouter();

  return (
    <CourseForm
      submitLabel="Create course"
      busyLabel="Creating..."
      onSubmit={async (values) => {
        // instructor ki ID body se nahi jaati: backend login se leta hai, aur status hamesha draft
        const d = await api<{ course: { _id: string } }>("/courses", {
          method: "POST",
          body: values,
        });
        router.push(`/instructor/courses/${d.course._id}`);
      }}
    />
  );
}