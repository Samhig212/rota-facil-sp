import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type InvoiceStatus } from "@/lib/fleet";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { bg: string; dot: string; text: string; border: string }
> = {
  pendente: {
    bg: "bg-muted/80",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    border: "border-border/70",
  },
  em_rota: {
    bg: "bg-amber-500/15 dark:bg-amber-400/15",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
    border: "border-amber-500/30",
  },
  entregue: {
    bg: "bg-emerald-500/15 dark:bg-emerald-400/15",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
  },
  devolvida: {
    bg: "bg-rose-500/15 dark:bg-rose-400/15",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    border: "border-rose-500/30",
  },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as InvoiceStatus;
  const cfg = STATUS_CONFIG[s] ?? {
    bg: "bg-muted/80",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    border: "border-border/70",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-200",
        cfg.bg,
        cfg.text,
        cfg.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-card/80 px-6 py-4 backdrop-blur-md transition-all duration-200 supports-[backdrop-filter]:bg-card/75 sm:px-8">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs font-normal text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}

export function Plate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border-2 border-foreground/80 bg-card px-2 py-0.5 font-mono text-xs font-black tracking-wider text-foreground shadow-xs transition-transform duration-200 hover:scale-105",
        className,
      )}
    >
      {children}
    </span>
  );
}
