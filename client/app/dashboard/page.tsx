import type { Metadata } from "next";
import StudentDashboard from "@/components/StudentDashboard";

export const metadata: Metadata = { title: "My learning" };

export default function StudentDashboardPage() {
  return <StudentDashboard />;
}