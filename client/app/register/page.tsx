import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Sign up" };

// SSG
export default function RegisterPage() {
  return (
    <AuthCard title="Create your account" subtitle="Learn new skills, or share your own">
      <RegisterForm />
    </AuthCard>
  );
}