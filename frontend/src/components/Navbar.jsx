import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditBadge } from "@/components/CreditBadge";
import { UserMenu } from "@/components/UserMenu";
import { useCredits } from "@/context/CreditContext";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  Crown,
  LogIn,
  Menu,
  X,
  Clapperboard,
  HelpCircle,
  ArrowRight,
  Home,
} from "lucide-react";

export const Navbar = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const waSupportUrl = `https://wa.me/6281234567890?text=${encodeURIComponent(
    "Halo Admin Sinergi Visual, saya member VIP. Saya butuh bantuan / konsultasi seputar generator prompt UGC."
  )}`;

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Logo linkTo="/" size="md" />

        {/* Right Section: Navigation Links, Badges & Actions */}
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
          {/* Desktop Navigation Links */}
          {pathname === "/" && (
            <nav className="mr-1 hidden items-center gap-1.5 lg:gap-2.5 md:flex">
              <a
                href="#top"
                className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                data-testid="nav-beranda"
              >
                Dashboard
              </a>
              <a
                href="#pembelajaran"
                className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                data-testid="nav-pembelajaran"
              >
                Area Pembelajaran
              </a>
              <a
                href="#prompt-vault"
                className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                data-testid="nav-prompt-vault"
              >
                Library Prompt
              </a>
              <Link
                to="/create"
                className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                data-testid="nav-buka-studio"
              >
                Buka Studio
              </Link>
              <a
                href={waSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1.5"
                data-testid="nav-vip-support"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>VIP Support</span>
              </a>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="rounded-xl px-3 py-1.5 text-xs lg:text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5 ml-0.5"
                  data-testid="nav-admin"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </nav>
          )}

          {/* Compact Credit Badge (Always Visible for quick balance check) */}
          <div className="flex items-center">
            <CreditBadge />
          </div>

          {/* User Profile / Auth Button */}
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link to="/login">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl border-border/80 bg-secondary/30 px-3 text-xs font-bold hover:bg-secondary"
                data-testid="navbar-login-btn"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Masuk</span>
              </Button>
            </Link>
          )}

          {/* Desktop Secondary Buttons */}
          <div className="hidden items-center gap-2.5 md:flex">
            <ThemeToggle />

            {pathname !== "/create" ? (
              <Link to="/create" data-testid="navbar-create-btn">
                <Button className="h-9.5 lg:h-10 gap-2 rounded-xl px-4 lg:px-5 text-xs lg:text-sm font-bold shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Buat Prompt</span>
                </Button>
              </Link>
            ) : (
              <Link to="/" data-testid="navbar-home-btn">
                <Button variant="outline" className="h-9.5 lg:h-10 rounded-xl px-4 text-xs lg:text-sm font-semibold">
                  Dashboard
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button (md:hidden) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Buka Menu Navigasi Mobile"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-secondary/40 text-foreground transition-colors hover:bg-secondary md:hidden"
            data-testid="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur-xl md:hidden animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            {/* Primary Action in Mobile Drawer */}
            {pathname !== "/create" ? (
              <Link to="/create" onClick={closeMobileMenu}>
                <Button className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-md">
                  <Sparkles className="h-4 w-4" />
                  <span>Buka Studio Generator UGC</span>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            ) : (
              <Link to="/" onClick={closeMobileMenu}>
                <Button variant="outline" className="h-11 w-full gap-2 rounded-xl text-sm font-medium">
                  <Home className="h-4 w-4" />
                  <span>Ke Dashboard Member</span>
                </Button>
              </Link>
            )}

            {/* Navigation links in Mobile Drawer */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="#top"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Home className="h-4 w-4 text-primary" />
                <span>Dashboard</span>
              </a>
              <a
                href="#pembelajaran"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Clapperboard className="h-4 w-4 text-primary" />
                <span>Pembelajaran</span>
              </a>
              <a
                href="#prompt-vault"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Library Prompt</span>
              </a>
              <Link
                to="/create"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 p-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Buka Studio</span>
              </Link>
              <a
                href={waSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                className="col-span-2 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <HelpCircle className="h-4 w-4" />
                <span>VIP WhatsApp Support</span>
              </a>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={closeMobileMenu}
                  className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 p-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 transition-colors"
                >
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span>Buka Admin Panel (Invite-Only)</span>
                </Link>
              )}
            </div>

            {/* Bottom Row: Theme Toggle on Mobile */}
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>Mode Tampilan</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
