"use client";

import { useEffect } from "react";

const COOKIE = "regaged_did";
const MAX_AGE = 60 * 60 * 24 * 400;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ensures a long-lived device cookie exists for multi-account detection. */
export default function DeviceIdInit() {
  useEffect(() => {
    const existing = readCookie(COOKIE);
    if (existing && /^[a-f0-9]{16,64}$/i.test(existing)) return;
    const id = randomId();
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
  }, []);
  return null;
}
