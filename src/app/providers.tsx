"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/app/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
