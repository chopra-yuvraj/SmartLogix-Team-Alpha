import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartLogix — Dynamic Freight Consolidation & Green Routing",
  description:
    "Zero-hardware, cloud-native platform that consolidates India's LTL freight into algorithmically routed, multi-stop loads with reverse-bidding and GLEC carbon savings.",
  manifest: "/manifest.json",
  themeColor: "#0066ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://unpkg.com/maplibre-gl@4.1.1/dist/maplibre-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
