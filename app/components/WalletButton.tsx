"use client";
import dynamic from "next/dynamic";

export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
);
