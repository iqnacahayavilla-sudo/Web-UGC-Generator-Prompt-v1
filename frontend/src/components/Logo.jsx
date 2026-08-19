import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

export const LogoIcon = ({ className = "w-9 h-9", glow = true }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const logoSrc = isDark ? "/favicon.svg" : "/favicon1.svg";

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {glow && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 opacity-25 blur-md dark:opacity-40" />
      )}
      <img
        src={logoSrc}
        alt="Sinergi Visual Logo"
        key={theme}
        className="relative w-full h-full object-contain drop-shadow-sm transition-all duration-300 transform hover:scale-105"
      />
    </div>
  );
};

export const Logo = ({
  showText = true,
  size = "md",
  linkTo = "/",
  clickable = true,
  className = "",
  subtitle = "UGC Generator Prompt",
}) => {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  };

  const titleSizes = {
    sm: "text-sm",
    md: "text-[15px] sm:text-base",
    lg: "text-lg sm:text-xl",
  };

  const subtitleSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  };

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <LogoIcon className={iconSizes[size] || iconSizes.md} />
      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-extrabold tracking-tight text-foreground ${titleSizes[size] || titleSizes.md}`}>
              SINERGI VISUAL
            </span>
          </div>
          <span className={`font-display font-bold uppercase tracking-[0.14em] text-primary ${subtitleSizes[size] || subtitleSizes.md}`}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );

  if (clickable && linkTo) {
    return (
      <Link to={linkTo} data-testid="brand-logo" className="transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
