import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "Expenditure",
        short_name: "Expenditure",
        description: "Track expenses and income, manage monthly budgets, and split shared spending with Circles.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#181b18",
        theme_color: "#181b18",
        categories: ["finance", "productivity"],
        icons: [
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
