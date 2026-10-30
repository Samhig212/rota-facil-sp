import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 text-xl font-extrabold text-sidebar-accent-foreground">
          <Truck className="text-sidebar-primary" /> RotaFacil <span className="text-sidebar-primary">SP</span>
        </div>
        <div>
          <h1 className="text-5xl font-extrabold leading-tight text-sidebar-accent-foreground">
            Carga certa,<br />rota curta,<br />turno fechado.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">
            Lance NF-e, despache por proximidade e feche o dia com KM e baixa de cada entrega.
          </p>
        </div>
        <div className="hazard-stripe h-3 w-full rounded" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
            <p className="text-sm text-muted-foreground">Acesso da equipe de operação</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
