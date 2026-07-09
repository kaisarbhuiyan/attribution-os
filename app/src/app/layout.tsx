import type { Metadata } from "next";


import "./globals.css";

export const metadata: Metadata = {
  title: "Attribution OS — Multi-Touch Marketing Attribution Engine",
  description:
    "Interactive dashboard comparing last-click vs data-driven (Markov) attribution models. See how channel credit shifts reveal where your budget is misallocated.",
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
