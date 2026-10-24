import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aria · Aura Skincare Voice Support",
  description:
    "Real-time AI voice customer support agent for Aura Skincare powered by Google Gemini and browser Web Speech API.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-aura-bg text-aura-text-primary antialiased selection:bg-aura-sage-light selection:text-aura-sage-hover">
        {children}
      </body>
    </html>
  );
}
