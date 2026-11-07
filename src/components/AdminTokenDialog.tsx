import { useState, useEffect } from "react";
import { KeyRound, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getAdminToken, setAdminToken } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DialogState {
  open: boolean;
  actionDescription: string;
  resolve?: (authorized: boolean) => void;
}

export function AdminTokenDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    actionDescription: "salvar alterações",
  });
  const [tokenInput, setTokenInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Escuta evento manual para abrir solicitação de token
    function handleOpenPrompt(e: Event) {
      const customEvent = e as CustomEvent<{ actionDescription?: string; resolve?: (authorized: boolean) => void }>;
      setTokenInput(getAdminToken() || "");
      setErrorMsg(null);
      setState({
        open: true,
        actionDescription: customEvent.detail?.actionDescription || "salvar alterações",
        resolve: customEvent.detail?.resolve,
      });
    }

    // Escuta evento disparado quando uma requisição retorna 403 admin_token_required
    function handleTokenRequired() {
      setTokenInput(getAdminToken() || "");
      setErrorMsg("A requisição foi recusada porque o token do administrador é necessário.");
      setState((prev) => ({
        ...prev,
        open: true,
        actionDescription: "concluir esta operação",
      }));
    }

    window.addEventListener("rf:open-admin-token-dialog", handleOpenPrompt);
    window.addEventListener("rf:admin-token-required", handleTokenRequired);

    return () => {
      window.removeEventListener("rf:open-admin-token-dialog", handleOpenPrompt);
      window.removeEventListener("rf:admin-token-required", handleTokenRequired);
    };
  }, []);

  async function handleConfirm(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMsg("Por favor, digite o token do administrador.");
      return;
    }

    setValidating(true);
    setErrorMsg(null);

    try {
      const res = await api.auth.verifyAdminToken(cleanToken);
      if (res.valid) {
        setAdminToken(cleanToken);
        toast.success("Autorização de Administrador concedida com sucesso!");
        state.resolve?.(true);
        setState((prev) => ({ ...prev, open: false, resolve: undefined }));
      } else {
        setErrorMsg("Token de administrador incorreto. Verifique com a gerência.");
        state.resolve?.(false);
      }
    } catch (err: any) {
      const msg = err.data?.error || err.message || "Token de administrador inválido.";
      setErrorMsg(msg);
      state.resolve?.(false);
    } finally {
      setValidating(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      state.resolve?.(false);
      setState((prev) => ({ ...prev, open: false, resolve: undefined }));
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-border/80 bg-card p-6 shadow-xl">
        <DialogHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
            <KeyRound size={24} />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Autorização do Administrador
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed font-normal">
              Esta ação requer privilégio de modificação. Como operador, informe o{" "}
              <strong className="text-foreground">Token de Modificação do Administrador</strong> para{" "}
              <span className="text-primary font-semibold">{state.actionDescription}</span>.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="admin-token-input" className="text-xs font-semibold text-foreground">
              Token de Modificação (configurado no backend)
            </Label>
            <div className="relative">
              <Input
                id="admin-token-input"
                type="text"
                autoFocus
                placeholder="ex: ADMIN123"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="rounded-xl pr-10 font-mono transition-all duration-200 focus-visible:ring-primary/40"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none">
                <ShieldCheck size={18} />
              </div>
            </div>
            {errorMsg ? (
              <p className="text-xs text-destructive font-medium flex items-center gap-1.5 animate-in fade-in-50">
                <ShieldAlert size={13} className="shrink-0" />
                <span>{errorMsg}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Dica de demonstração: o token padrão é <span className="font-mono font-bold text-foreground">ADMIN123</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={validating}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={validating}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20"
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                "Validar & Autorizar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
