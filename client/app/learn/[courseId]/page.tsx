import type { Metadata } from "next";
import LearnView from "@/components/LearnView";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <LearnView courseId={courseId} />;
}