import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "pill" | "sidebar";
}

export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (variant === "sidebar") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className={cn(
          "w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 rounded-xl px-3 py-2 text-xs font-medium",
          className,
        )}
        aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      >
        <span className="flex items-center gap-2">
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 text-slate-300 transition-transform duration-300 hover:-rotate-12" />
          )}
          <span>{isDark ? "Tema Claro" : "Tema Escuro"}</span>
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sidebar-accent border border-sidebar-border text-sidebar-foreground/70">
          {isDark ? "Dark" : "Light"}
        </span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "relative h-9 w-9 rounded-xl border-border/70 bg-card/60 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 hover:border-primary/50 hover:bg-accent/50",
        className,
      )}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
    >
      <Sun
        className={cn(
          "h-4 w-4 text-amber-500 transition-all duration-300",
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 text-sky-400 transition-all duration-300",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        )}
      />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}

