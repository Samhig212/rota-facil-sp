import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  LogOut,
  Map,
  MapPin,
  Route as RouteIcon,
  Truck,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { vehiclesQuery } from "@/lib/fleet";
import { getAllMaintenanceAlerts, useVehicleMaintenance } from "@/lib/vehicle-maintenance";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await api.auth.me();
      if (!user) throw redirect({ to: "/auth" });
      return { user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: Shell,
});

const NAV = [
  { to: "/mapa", label: "Mapa Operacional", icon: Map },
  { to: "/notas", label: "Lançar NF-e", icon: FileText },
  { to: "/despacho", label: "Despacho & Rota", icon: RouteIcon },
  { to: "/fechamento", label: "Fechamento", icon: ClipboardCheck },
  { to: "/cadastros", label: "Frota & Manutenção", icon: Wrench, hasAlerts: true },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data: vehicles } = useQuery(vehiclesQuery);
  const { records } = useVehicleMaintenance();

  const maintenanceAlerts = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return { urgentCount: 0, warningCount: 0, totalCount: 0 };
    return getAllMaintenanceAlerts(vehicles);
  }, [vehicles, records]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Truck size={18} />
          </div>
          <span>
            RotaFacil <span className="text-primary font-black">SP</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {maintenanceAlerts.urgentCount > 0 && (
            <Link
              to="/cadastros"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold animate-pulse"
              title={`${maintenanceAlerts.urgentCount} manutenção(ões) vencida(s)`}
            >
              <AlertTriangle size={12} />
              <span>{maintenanceAlerts.urgentCount}</span>
            </Link>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => {
              api.auth.logout();
              window.dispatchEvent(new CustomEvent("rf:auth-change"));
              navigate({ to: "/auth" });
            }}
            aria-label="Sair"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      {/* Desktop / Responsive Sidebar */}
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:sticky md:top-0 md:h-screen md:w-64 border-r border-sidebar-border/60">
        <div className="flex items-center justify-between px-5 py-5 text-xl font-black tracking-tight text-sidebar-accent-foreground">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <Truck size={20} />
            </div>
            <span>
              RotaFacil <span className="text-sidebar-primary font-black">SP</span>
            </span>
          </div>
        </div>

        {/* Linha de destaque corporativo */}
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 opacity-90" />

        {/* Base de Operação Indicator */}
        <div className="mx-3 my-2.5 rounded-xl bg-sidebar-accent/50 p-2.5 border border-sidebar-border/50 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-sidebar-primary mb-0.5">
            <MapPin size={12} />
            <span>Ponto de Partida / Base</span>
          </div>
          <p className="text-sidebar-foreground/80 font-medium truncate" title="Rua Professor Oswaldo Quirino Simões, 142">
            R. Prof. Oswaldo Quirino Simões, 142
          </p>
          <span className="text-[10px] text-sidebar-foreground/50">Socorro · São Paulo - SP</span>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:space-y-1.5 md:overflow-x-visible">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="group flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5 active:scale-98"
              activeProps={{
                className:
                  "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-600 hover:text-white",
              }}
            >
              <div className="flex items-center gap-3">
                <n.icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
                <span>{n.label}</span>
              </div>
              {"hasAlerts" in n && maintenanceAlerts.totalCount > 0 && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    maintenanceAlerts.urgentCount > 0
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                  title={`${maintenanceAlerts.totalCount} alertas de manutenção/vistoria`}
                >
                  {maintenanceAlerts.urgentCount > 0 ? `! ${maintenanceAlerts.urgentCount}` : maintenanceAlerts.totalCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer info & Controls */}
        <div className="mt-auto hidden flex-col gap-3 border-t border-sidebar-border/70 p-4 md:flex">
          <ThemeToggle variant="sidebar" />

          <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/50 p-2.5 border border-sidebar-border/60">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/60">
                Operador Logístico
              </p>
              <p className="truncate text-xs font-medium text-sidebar-foreground" title={user.email}>
                {user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-destructive transition-colors duration-200 rounded-lg"
              title="Encerrar sessão"
              aria-label="Sair da conta"
              onClick={() => {
                api.auth.logout();
                window.dispatchEvent(new CustomEvent("rf:auth-change"));
                navigate({ to: "/auth" });
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
