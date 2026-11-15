import { setAuthCookies, clearAuthCookies } from "../utils/cookies.js";

const calls = [];
const fakeRes = {
  cookie: (name, value, opts) => calls.push({ name, value, opts }),
  clearCookie: (name, opts) => calls.push({ name, cleared: true, opts }),
};

setAuthCookies(fakeRes, "ACCESS", "REFRESH");

const access = calls.find((c) => c.name === "accessToken");
const refresh = calls.find((c) => c.name === "refreshToken");

console.log("Access httpOnly:", access.opts.httpOnly);
console.log("Access path:", access.opts.path);
console.log("Refresh httpOnly:", refresh.opts.httpOnly);
console.log("Refresh path:", refresh.opts.path);
console.log("Refresh lives longer:", refresh.opts.maxAge > access.opts.maxAge);
console.log("Local sameSite:", access.opts.sameSite);

calls.length = 0;
clearAuthCookies(fakeRes);
console.log("Cleared both:", calls.length === 2 && calls.every((c) => c.cleared));
console.log("Clear uses same path:", calls[1].opts.path === "/api/auth");