import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, MapPin, ShieldCheck, Truck, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — RotaFacil SP" },
      { name: "description", content: "Acesse o painel de gestão de frota e despacho RotaFacil SP." },
      { property: "og:title", content: "Entrar — RotaFacil SP" },
      { property: "og:description", content: "Acesse o painel de gestão de frota e despacho RotaFacil SP." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [adminToken, setAdminTokenInput] = useState("");
  const [showAdminField, setShowAdminField] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        await api.auth.login(email, password);
        window.dispatchEvent(new CustomEvent("rf:auth-change"));
        navigate({ to: "/mapa" });
      } else {
        await api.auth.register(email, password, nome.trim() || undefined, adminToken.trim() || undefined);
        window.dispatchEvent(new CustomEvent("rf:auth-change"));
        toast.success("Conta criada e autenticada com sucesso!");
        navigate({ to: "/mapa" });
      }
    } catch (err: any) {
      toast.error(err.data?.error || err.message || "Erro na autenticação. Verifique os dados digitados.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount(userEmail: string, userPass: string) {
    setEmail(userEmail);
    setPassword(userPass);
    setMode("in");
    toast.info(`Credenciais preenchidas: ${userEmail}`);
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2 bg-background text-foreground animate-in fade-in-50 duration-300">
      {/* Botão de alternância de tema no topo direito */}
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      {/* Painel lateral visual */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex overflow-hidden border-r border-sidebar-border/60">
        <div className="flex items-center gap-2.5 text-2xl font-black text-sidebar-accent-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <Truck size={22} />
          </div>
          <span>
            RotaFacil <span className="text-sidebar-primary">SP</span>
          </span>
        </div>

        <div className="space-y-4 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-sidebar-primary/15 border border-sidebar-primary/25 px-3.5 py-1 text-xs font-bold text-sidebar-primary tracking-wide uppercase">
            <ShieldCheck size={14} />
            <span>Logística & Roteirização Estratégica SP</span>
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-sidebar-accent-foreground xl:text-5xl">
            Carga certa,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              rota inteligente isolada,
            </span><br />
            turno 100% fechado.
          </h1>
          <p className="text-sm text-sidebar-foreground/80 leading-relaxed font-normal">
            Importe NF-e via XML em segundos, otimize a sequência de entrega de nota a nota mais próxima e monitore motoristas, CNHs e ocorrências com total isolamento por conta de operador.
          </p>

          <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-3.5 text-xs text-sidebar-foreground/80 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-sidebar-accent-foreground">
              <Users size={14} className="text-sidebar-primary" />
              <span>Espaços de Trabalho Isolados (Multi-Tenancy)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-sidebar-foreground/70">
              Cada conta de operador possui sua própria fila de notas fiscais e histórico de rotas desassociado de outras contas. Modificações no sistema exigem o token de autorização do administrador.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-1 w-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 opacity-80" />
          <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/60 font-mono">
            <MapPin size={13} className="text-sidebar-primary shrink-0" />
            <span>Base Operacional: Rua Professor Oswaldo Quirino Simões, 142 · Socorro / SP</span>
          </div>
        </div>
      </div>

      {/* Área do formulário */}
      <div className="flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/70 bg-card/90 p-8 shadow-sm backdrop-blur-md my-auto">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Truck size={18} />
              </div>
              <span className="font-black text-lg">RotaFacil SP</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              {mode === "in" ? "Acessar Sistema" : "Criar Nova Conta"}
            </h2>
            <p className="text-xs text-muted-foreground font-normal">
              {mode === "in"
                ? "Entre com suas credenciais de operador ou gestor"
                : "Preencha seus dados para criar sua área de trabalho"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-semibold">
                  Nome do operador / gestor
                </Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Carlos Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                />
              </div>
            )}

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

            {mode === "up" && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminField(!showAdminField)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                >
                  <KeyRound size={13} />
                  <span>{showAdminField ? "Ocultar Token de Admin" : "Possui Token de Administrador? (Opcional)"}</span>
                </button>

                {showAdminField && (
                  <div className="space-y-1.5 animate-in fade-in-50">
                    <Label htmlFor="adminToken" className="text-[11px] font-medium text-muted-foreground">
                      Token do Administrador (para criar com privilégio de Gestor)
                    </Label>
                    <Input
                      id="adminToken"
                      type="text"
                      placeholder="ex: ADMIN123"
                      value={adminToken}
                      onChange={(e) => setAdminTokenInput(e.target.value)}
                      className="rounded-xl font-mono text-xs transition-all duration-200 focus-visible:ring-primary/40"
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 py-2.5 mt-2"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              {mode === "in" ? "Entrar na Operação" : "Cadastrar Conta"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setShowAdminField(false);
              }}
            >
              {mode === "in"
                ? "Não tem conta? Cadastrar operador"
                : "Já possui conta? Fazer login"}
            </button>
          </form>

          {/* Atalhos de Acesso Rápido para Demonstração */}
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground text-[11px]">
              <UserCheck size={13} className="text-primary" />
              <span>Contas de Demonstração & Teste:</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => fillDemoAccount("operacao@rotafacil.com.br", "123456")}
                className="flex flex-col items-start p-1.5 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-colors"
              >
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Gestor / Admin</span>
                <span className="text-[10px] text-muted-foreground truncate w-full">operacao@...</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount("sam12@gmail.com", "123456")}
                className="flex flex-col items-start p-1.5 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-colors"
              >
                <span className="font-bold text-blue-600 dark:text-blue-400">Operador 1</span>
                <span className="text-[10px] text-muted-foreground truncate w-full">sam12@...</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Token padrão de modificação: <span className="font-mono font-bold text-foreground">ADMIN123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
