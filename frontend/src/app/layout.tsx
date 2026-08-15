import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CASE//ZERO",
  description: "Cybersecurity Operations and Investigation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}