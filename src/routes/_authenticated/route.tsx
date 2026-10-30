import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import {
  ClipboardCheck,
  FileText,
  LogOut,
  Map,
  Route as RouteIcon,
  Truck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/notas", label: "Lançar NF-e", icon: FileText },
  { to: "/despacho", label: "Despacho", icon: RouteIcon },
  { to: "/fechamento", label: "Fechamento", icon: ClipboardCheck },
  { to: "/cadastros", label: "Frota & Motoristas", icon: Users },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Truck size={18} />
          </div>
          <span>
            RotaFacil <span className="text-sidebar-primary">SP</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            aria-label="Sair"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      {/* Desktop / Responsive Sidebar */}
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:sticky md:top-0 md:h-screen md:w-64">
        <div className="flex items-center gap-2.5 px-5 py-5 text-xl font-black tracking-tight text-sidebar-accent-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-stone-950 shadow-md shadow-amber-500/20">
            <Truck size={20} />
          </div>
          <span>
            RotaFacil <span className="text-sidebar-primary font-black">SP</span>
          </span>
        </div>

        <div className="hazard-stripe h-1 shadow-xs" />

        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:space-y-1 md:overflow-x-visible">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="group flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5 active:scale-98"
              activeProps={{
                className:
                  "bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 hover:text-stone-950",
              }}
            >
              <n.icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer info & Controls */}
        <div className="mt-auto hidden flex-col gap-3 border-t border-sidebar-border/70 p-4 md:flex">
          <ThemeToggle variant="sidebar" />

          <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/50 p-2.5 border border-sidebar-border/60">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/60">
                Logística
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
              onClick={async () => {
                await supabase.auth.signOut();
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
