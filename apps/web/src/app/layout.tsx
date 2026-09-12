import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The House Of Coding — Futuristic HUD Interface",
  description: "Cybernetic HUD control interface and AI-native operating workspace with autonomous agents, telemetry, and radar diagnostics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#030810] text-[#00f3ff] antialiased selection:bg-[#00f3ff]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
