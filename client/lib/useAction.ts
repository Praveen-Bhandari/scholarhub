"use client";

import { useState } from "react";

// ek action chalao: busy/error khud sambhalta hai, kaam hone par onDone (reload) chalata hai
export function useAction(onDone?: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onDone?.();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}