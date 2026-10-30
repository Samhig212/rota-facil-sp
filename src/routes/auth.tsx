import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — RotaFacil SP" },
      { name: "description", content: "Acesse o painel de gestão de frota RotaFacil SP." },
      { property: "og:title", content: "Entrar — RotaFacil SP" },
      { property: "og:description", content: "Acesse o painel de gestão de frota RotaFacil SP." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/mapa" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/mapa" });
        else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2 bg-background text-foreground animate-in fade-in-50 duration-300">
      {/* Botão de alternância de tema no topo direito */}
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      {/* Painel lateral visual */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex overflow-hidden">
        <div className="flex items-center gap-2.5 text-2xl font-black text-sidebar-accent-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-stone-950 shadow-md shadow-amber-500/20">
            <Truck size={22} />
          </div>
          <span>
            RotaFacil <span className="text-sidebar-primary">SP</span>
          </span>
        </div>

        <div className="space-y-4 my-auto">
          <span className="inline-flex items-center rounded-full bg-sidebar-primary/15 border border-sidebar-primary/25 px-3 py-1 text-xs font-bold text-sidebar-primary tracking-wide uppercase">
            Logística Inteligente em São Paulo
          </span>
          <h1 className="text-5xl font-black leading-tight tracking-tight text-sidebar-accent-foreground xl:text-6xl">
            Carga certa,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              rota curta,
            </span><br />
            turno fechado.
          </h1>
          <p className="max-w-md text-sm text-sidebar-foreground/80 leading-relaxed font-normal">
            Lance notas fiscais via XML em lote, despache por proximidade geográfica e feche o dia com apontamento de KM e baixa de cada parada.
          </p>
        </div>

        <div className="space-y-3">
          <div className="hazard-stripe h-2.5 w-full rounded-full shadow-xs" />
          <p className="text-[11px] text-sidebar-foreground/50 font-mono">
            Centro de Distribuição Barra Funda · São Paulo - SP
          </p>
        </div>
      </div>

      {/* Área do formulário */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/70 bg-card/80 p-8 shadow-sm backdrop-blur-md">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              {mode === "in" ? "Acessar Sistema" : "Criar Nova Conta"}
            </h2>
            <p className="text-xs text-muted-foreground font-normal">
              Painel de despacho e gestão operacional de frota
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                E-mail corporativo
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="operacao@rotafacil.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 py-2.5"
            >
              {loading && <Loader2 className="animate-spin mr-2" />}
              {mode === "in" ? "Entrar na Operação" : "Cadastrar Operador"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in"
                ? "Não tem conta? Cadastrar operador"
                : "Já possui conta? Fazer login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
