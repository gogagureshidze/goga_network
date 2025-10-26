"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark, neobrutalism } from "@clerk/themes";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ClerkThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, resolvedTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for component to mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the actual current theme
  // If theme is "system", use systemTheme or resolvedTheme
  // Otherwise use the explicit theme setting
  let currentTheme = theme;
  if (theme === "system") {
    currentTheme = systemTheme || resolvedTheme;
  }

  const isDark = mounted && currentTheme === "dark";

  // Debug log (remove after testing)
  useEffect(() => {
    if (mounted) {
      console.log("🎨 Clerk Theme Debug:", {
        theme,
        resolvedTheme,
        systemTheme,
        currentTheme,
        isDark,
        mounted,
      });
    }
  }, [theme, resolvedTheme, systemTheme, currentTheme, isDark, mounted]);

  // Use appropriate Clerk theme
  const clerkTheme = isDark ? [dark, neobrutalism] : [neobrutalism];

  // Don't render until mounted to prevent flash
  if (!mounted) {
    return (
      <ClerkProvider
        appearance={{
          baseTheme: [neobrutalism],
        }}
      >
        {children}
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: clerkTheme,
        variables: {
          colorPrimary: "#f97316",
          colorBackground: isDark ? "#1f2937" : "#ffffff",
          colorInputBackground: isDark ? "#374151" : "#f9fafb",
          colorInputText: isDark ? "#f3f4f6" : "#111827",
          colorText: isDark ? "#f3f4f6" : "#111827",
          colorTextSecondary: isDark ? "#d1d5db" : "#6b7280",
          colorTextOnPrimaryBackground: isDark ? "#ffffff" : "#111827",
          colorNeutral: isDark ? "#9ca3af" : "#6b7280",
        },
        elements: {
          // Fix all text elements
          headerTitle: {
            color: isDark ? "#f3f4f6" : "#111827",
          },
          headerSubtitle: {
            color: isDark ? "#d1d5db" : "#6b7280",
          },
          socialButtonsBlockButton: {
            color: isDark ? "#f3f4f6" : "#111827",
          },
          formFieldLabel: {
            color: isDark ? "#f3f4f6" : "#111827",
          },
          formFieldInput: {
            backgroundColor: isDark ? "#374151" : "#f9fafb",
            color: isDark ? "#f3f4f6" : "#111827",
          },
          footerActionLink: {
            color: "#f97316",
          },
          card: {
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          // Fix any other text that might appear dark
          identityPreviewText: {
            color: isDark ? "#f3f4f6" : "#111827",
          },
          identityPreviewEditButton: {
            color: "#f97316",
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
