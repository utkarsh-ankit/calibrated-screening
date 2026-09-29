import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Calibrated Screening",
  description: "Hiring screen that knows when it doesn't know — built on Jev.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
