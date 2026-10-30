import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type InvoiceStatus } from "@/lib/fleet";

const STATUS_CLS: Record<InvoiceStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_rota: "bg-primary text-primary-foreground",
  entregue: "bg-success text-success-foreground",
  devolvida: "bg-destructive text-destructive-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as InvoiceStatus;
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide", STATUS_CLS[s])}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-card px-6 py-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Plate({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded border-2 border-foreground bg-card px-1.5 font-mono text-xs font-bold tracking-wider">
      {children}
    </span>
  );
}
