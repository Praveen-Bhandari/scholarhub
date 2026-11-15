import type { Metadata } from "next";
import AdminDashboard from "@/components/AdminDashboard";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminPage() {
  return <AdminDashboard />;
}