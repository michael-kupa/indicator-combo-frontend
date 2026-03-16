import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Indicator Combo Analyzer",
  description: "Backtest technical indicator combinations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}