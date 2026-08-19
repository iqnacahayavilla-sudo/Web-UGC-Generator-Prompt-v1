import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`relative h-9 w-9 rounded-xl border border-border/60 bg-secondary/60 text-foreground transition-all hover:bg-secondary hover:text-foreground hover:scale-105 active:scale-95 ${className}`}
      aria-label={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
      title={isDark ? "Mode Terang" : "Mode Gelap"}
      data-testid="theme-toggle-btn"
    >
      <Sun
        className={`h-4 w-4 text-amber-500 transition-all duration-300 ${isDark ? "rotate-90 scale-0 opacity-0 absolute" : "rotate-0 scale-100 opacity-100"
          }`}
      />
      <Moon
        className={`h-4 w-4 text-indigo-400 transition-all duration-300 ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0 absolute"
          }`}
      />
    </Button>
  );
};

export default ThemeToggle;
