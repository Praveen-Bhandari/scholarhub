const isProd = process.env.NODE_ENV === "production";

const base = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000, // 15 minute
    path: "/",
  });

  res.cookie("refreshToken", refreshToken, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din
    path: "/api/auth", // sirf auth routes par jayegi
  });
}

export function clearAuthCookies(res) {
  // clear karte waqt wahi options (path wagairah) dene padte hain
  res.clearCookie("accessToken", { ...base, path: "/" });
  res.clearCookie("refreshToken", { ...base, path: "/api/auth" });
}