import "./globals.css";
import type { Metadata } from "next";
import Navigation from "./components/Navigation";

export const metadata: Metadata = {
  title: "GILLTY — is your match real?",
  description:
    "A tamper-proof 'this is really them' check for online dating. Capture live, seal on Solana, verify anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
