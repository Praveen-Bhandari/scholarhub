import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

// SSG
export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="We will email you a link to reset it">
      <ForgotPasswordForm />
    </AuthCard>
  );
}