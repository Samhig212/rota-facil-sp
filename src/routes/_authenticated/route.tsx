import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, FileText, LogOut, Map, Route as RouteIcon, Truck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-extrabold text-sidebar-accent-foreground">
          <Truck className="text-sidebar-primary" size={22} /> RotaFacil <span className="text-sidebar-primary">SP</span>
        </div>
        <div className="hazard-stripe h-1.5" />
        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground" }}
            >
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-sidebar-border p-4 md:block">
          <p className="truncate text-xs text-sidebar-foreground/70">{user.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut size={16} /> Sair
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
