import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

// SSG
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}