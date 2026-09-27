import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";


export const metadata: Metadata = {
  title: {
    default: "CASE//ZERO",
    template: "%s | CASE//ZERO",
  },

  description:
    "Cybersecurity operations and investigation platform.",

  applicationName: "CASE//ZERO",
};


export const viewport: Viewport = {
  themeColor: "#071019",
  colorScheme: "dark",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="bg-[#04080d]"
    >
      <body className="cz-app-shell antialiased">
        {children}
      </body>
    </html>
  );
}