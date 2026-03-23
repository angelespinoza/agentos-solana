"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton as WalletMultiButton } from "./WalletButton";

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/builder",     label: "Builder" },
    { href: "/dashboard",   label: "Dashboard" },
  ];

  return (
    <>
      <nav className="navbar">
        <div className="container navbar-inner">

          {/* Logo */}
          <Link href="/" className="navbar-logo">
            ◈ AgentOS <span>/ Solana</span>
          </Link>

          {/* Desktop links */}
          <div className="navbar-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`navbar-link ${pathname === l.href ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right: wallet + hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <WalletMultiButton />

            {/* Hamburger — solo mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: "none",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: "1rem",
                lineHeight: 1,
              }}
              className="hamburger-btn"
              aria-label="Menú"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          position: "fixed",
          top: 64,
          left: 0,
          right: 0,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          zIndex: 99,
          padding: "12px 0",
        }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                padding: "14px 24px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                color: pathname === l.href ? "var(--sol-green)" : "var(--text-secondary)",
                textDecoration: "none",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .hamburger-btn { display: block !important; }
          .navbar-links  { display: none !important; }
          .wallet-adapter-button span { display: none; }
        }
      `}</style>
    </>
  );
}
