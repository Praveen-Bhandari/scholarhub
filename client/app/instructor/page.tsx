import type { Metadata } from "next";
import InstructorDashboard from "@/components/InstructorDashboard";

export const metadata: Metadata = { title: "Instructor dashboard" };


export default function InstructorDashboardPage() {
  return <InstructorDashboard />;
}