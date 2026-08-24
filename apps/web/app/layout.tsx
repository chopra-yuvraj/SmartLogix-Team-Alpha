import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartLogix — Dynamic Freight Consolidation & Green Routing",
  description:
    "Zero-hardware, cloud-native platform that consolidates India's LTL freight into algorithmically routed, multi-stop loads with reverse-bidding and GLEC carbon savings.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://unpkg.com/maplibre-gl@4.1.1/dist/maplibre-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-gray-950 text-gray-100" suppressHydrationWarning>{children}</body>
    </html>
  );
}
