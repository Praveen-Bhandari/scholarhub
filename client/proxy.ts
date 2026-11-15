import { NextResponse, type NextRequest } from "next/server";

type Role = "student" | "instructor" | "admin";

const HOME: Record<Role, string> = {
  student: "/dashboard",
  instructor: "/instructor",
  admin: "/admin",
};

// kis raste par kaun jaa sakta hai
const RULES: [string, Role[]][] = [
  ["/dashboard", ["student"]],
  ["/instructor", ["instructor"]],
  ["/admin", ["admin"]],
  ["/learn", ["student", "instructor", "admin"]],
];

// accessToken (JWT) ke beech ka hissa padhke role nikalta hai.
// ye sirf redirect ke liye hai, signature check nahi hota:
// asli suraksha backend ki hai (nakli cookie se API 401 deti hai)
function readRole(request: NextRequest): Role | null {
  const raw = request.cookies.get("accessToken")?.value;
  if (!raw) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return ["student", "instructor", "admin"].includes(payload.role) ? (payload.role as Role) : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const role = readRole(request);

  // login nahi: login page par, wapas aane ke liye ?next= ke saath
  if (!role) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // login hai par galat role: apne dashboard par
  const rule = RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (rule && !rule[1].includes(role)) {
    return NextResponse.redirect(new URL(HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/instructor/:path*", "/admin/:path*", "/learn/:path*"],
};