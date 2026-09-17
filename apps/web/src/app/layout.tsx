import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { NavPrincipal } from "@/components/NavPrincipal";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Advice",
  description: "Lembretes por WhatsApp e a operação dos dois negócios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${fraunces.variable}`}>
        <NavPrincipal />
        {children}
      </body>
    </html>
  );
}
