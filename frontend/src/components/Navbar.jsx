import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditBadge } from "@/components/CreditBadge";
import { UserMenu } from "@/components/UserMenu";
import { useCredits } from "@/context/CreditContext";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Crown, LogIn } from "lucide-react";

export const Navbar = () => {
  const { pathname } = useLocation();
  const { openPricingModal } = useCredits();
  const { isAuthenticated, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Brand Logo */}
        <Logo linkTo="/" size="md" />

        {/* Navigation Links & Actions */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {pathname === "/" && (
            <div className="mr-2 hidden items-center gap-1 md:flex">
              <a
                href="#top"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                data-testid="nav-beranda"
              >
                Beranda
              </a>
              <a
                href="#cara-kerja"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                data-testid="nav-cara-kerja"
              >
                Cara Kerja
              </a>
              <a
                href="#contoh"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                data-testid="nav-contoh"
              >
                Contoh Prompt
              </a>
              <button
                type="button"
                onClick={openPricingModal}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground flex items-center gap-1.5"
                data-testid="nav-pricing"
              >
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span>Paket & Top Up</span>
              </button>
            </div>
          )}

          {/* Credit Balance Indicator Badge */}
          <CreditBadge />

          {/* User Profile / Auth Button */}
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={openAuthModal}
              className="h-9 gap-1.5 rounded-xl border-border/80 bg-secondary/30 px-3 text-xs font-bold hover:bg-secondary"
              data-testid="navbar-login-btn"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Masuk</span>
            </Button>
          )}

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Create Button */}
          {pathname !== "/create" ? (
            <Link to="/create" data-testid="navbar-create-btn">
              <Button className="h-10 gap-2 rounded-xl px-4 sm:px-5 font-semibold shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Buat Prompt</span>
              </Button>
            </Link>
          ) : (
            <Link to="/" data-testid="navbar-home-btn">
              <Button variant="outline" className="h-10 rounded-xl px-4 text-sm font-medium">
                Beranda
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
