import { ApiError } from "./errors";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:5000";

interface Options {
  // seconds: itni der ke liye jawab yaad rakho (ISR). na do to har baar taaza (SSR)
  revalidate?: number;
}

export async function serverFetch<T>(path: string, options: Options = {}): Promise<T> {
  const res = await fetch(
    `${API_ORIGIN}/api${path}`,
    options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" }
  );

  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).message ?? message;
    } catch {
      // body khali
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}