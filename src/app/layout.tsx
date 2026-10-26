import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  metadataBase: new URL("https://expenses.tkkr.dev"),
  alternates: { canonical: "/" },
  title: "Expenditure",
  description: "Track expenses, categories, and monthly budgets.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" theme="dark" />
        </AuthProvider>
      </body>
    </html>
  );
}
