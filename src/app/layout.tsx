import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const description = "Track expenses and income, manage monthly budgets, and split shared spending with Circles.";
const socialImage = {
    url: "/images/social-card.png",
    width: 1200,
    height: 630,
    alt: "Expenditure — expenses, budgets, and shared spending with Circles.",
};

export const metadata: Metadata = {
    metadataBase: new URL("https://expenditure.tkkr.dev"),
    alternates: { canonical: "/" },
    title: "Expenditure",
    applicationName: "Expenditure",
    description,
    category: "finance",
    appleWebApp: {
        capable: true,
        title: "Expenditure",
        statusBarStyle: "black",
    },
    openGraph: {
        type: "website",
        url: "/",
        siteName: "Expenditure",
        title: "Expenditure",
        description,
        images: [socialImage],
    },
    twitter: {
        card: "summary_large_image",
        title: "Expenditure",
        description,
        images: [socialImage],
    },
    other: { "apple-mobile-web-app-capable": "yes" },
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    themeColor: "#181b18",
    colorScheme: "dark",
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
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground">
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
