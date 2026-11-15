import { ApiError } from "./errors";

// in par 401 aaye to refresh nahi karte (ye khud login ke hisse hain)
const NO_RETRY = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
];

let refreshing: Promise<boolean> | null = null;

// kai request ek saath 401 par aayein to refresh sirf ek baar hota hai
// (backend me dusra refresh "reuse" maana jata aur session band ho jata)
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown; // JSON me jayega
  formData?: FormData; // file upload ke liye
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });

  let res = await send();

  if (res.status === 401 && !NO_RETRY.includes(path)) {
    if (await refreshSession()) res = await send();
  }

  if (!res.ok) {
    let message = res.statusText;
    let errors: { field: string; message: string }[] | undefined;
    try {
      const body = await res.json();
      message = body.message ?? message;
      errors = body.errors;
    } catch {
      // body khali
    }
    throw new ApiError(res.status, message, errors);
  }

  return (await res.json()) as T;
}