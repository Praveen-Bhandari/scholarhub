"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ProxyCheck() {
  const [text, setText] = useState("Checking...");

  useEffect(() => {
    api<{ ok: boolean }>("/health")
      .then((d) => setText(`Browser reached the API through the proxy (ok = ${String(d.ok)})`))
      .catch((e: Error) => setText(`Failed: ${e.message}`));
  }, []);

  return <p className="rounded bg-emerald-50 p-3 text-emerald-800">{text}</p>;
}