import type { Metadata } from "next";
import { Space_Mono, Syne } from "next/font/google";
import { WalletContextProvider } from "./providers/WalletProvider";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "AgentOS — No-Code AI Agents on Solana",
  description:
    "Crea, despliega y monetiza agentes de IA en Solana. Sin código. Con x402.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={`${syne.variable} ${spaceMono.variable}`}>
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
