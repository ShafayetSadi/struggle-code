import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Socrates AI",
  description: "The Socratic dialogue for developers — understand what you build.",
  icons: {
    icon: [{ url: "/socrates-ai-logo.png", type: "image/png" }],
    apple: [{ url: "/socrates-ai-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-[#0A0A0B] font-sans text-[#dce5d9] antialiased">{children}</body>
    </html>
  );
}
