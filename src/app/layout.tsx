import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { PortalWidget } from "shanu-portal-widget";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beam",
  description: "Zero-knowledge peer-to-peer file transfer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <PortalWidget />
      </body>
    </html>
  );
}
