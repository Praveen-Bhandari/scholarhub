import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Log in" };

// SSG: isme koi data nahi, sirf form, isliye build ke waqt hi ban jata hai
export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue learning">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}