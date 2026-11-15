import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";
import VerifyEmail from "@/components/VerifyEmail";

export const metadata: Metadata = { title: "Verify email" };

// SSG
export default function VerifyEmailPage() {
  return (
    <AuthCard title="Email verification">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}