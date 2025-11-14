import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neon Snake",
  description: "A modern web-based Snake game built with Next.js"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
