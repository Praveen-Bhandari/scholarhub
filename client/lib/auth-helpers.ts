import type { Role } from "./types";

// login ke baad kis role ko kahan bhejna hai
export const HOME_BY_ROLE: Record<Role, string> = {
  student: "/dashboard",
  instructor: "/instructor",
  admin: "/admin",
};

// ?next= sirf apni site ka rasta ho sakta hai (open redirect se bachav)
export function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}