"use client";

import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system" // Changed back to system to respect OS settings
      enableSystem={true} // Enable system theme detection
      storageKey="theme" // Use "theme" to match your localStorage
    >
      {children}
    </ThemeProvider>
  );
}
