"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { HOME_BY_ROLE } from "@/lib/auth-helpers";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-indigo-600">
          ScholarHub
        </Link>

        <div className="flex min-h-8 items-center gap-5 text-sm font-medium">
          <Link href="/courses" className="hover:text-indigo-600">
            Courses
          </Link>

          {!loading && user && (
            <>
              <Link href={HOME_BY_ROLE[user.role]} className="hover:text-indigo-600">
                Dashboard
              </Link>
              <span className="hidden text-slate-500 sm:inline">{user.name}</span>
              <button
                onClick={onLogout}
                className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          )}

          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-indigo-600">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}