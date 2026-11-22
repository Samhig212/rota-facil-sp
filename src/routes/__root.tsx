import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";

function NotFoundComponent() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, "");
      // Redireciona apelidos comuns de autenticação para /auth
      if (pathname === "/login" || pathname === "/signin" || pathname === "/entrar") {
        router.navigate({ to: "/auth" });
        return;
      }
      // Se 404.html capturou o caminho original da SPA
      const savedPath = sessionStorage.getItem("rf_redirect_path");
      if (savedPath) {
        sessionStorage.removeItem("rf_redirect_path");
        router.navigate({ to: savedPath as any });
        return;
      }
    }

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.navigate({ to: "/" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center p-8 rounded-2xl border border-border/80 bg-card shadow-lg">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-xl mb-3">
          404
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          O endereço solicitado não foi localizado no sistema. Redirecionando para a operação em{" "}
          <strong className="text-foreground font-mono">{countdown}s</strong>...
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link
            to="/mapa"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all duration-200 hover:scale-105 shadow-md shadow-blue-500/20"
          >
            Ir para o Mapa
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-muted/60 px-4 py-2 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-muted"
          >
            Fazer Login
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center p-8 rounded-2xl border border-border/80 bg-card shadow-lg">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Ops, algo deu errado
        </h1>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Ocorreu uma falha temporária ao carregar a visualização.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all hover:scale-105 shadow-md shadow-primary/20"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-card px-4 py-2 text-xs font-medium text-foreground transition-all hover:bg-accent"
          >
            Ir para início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const handleAuthChange = () => {
      router.invalidate();
      queryClient.invalidateQueries();
    };
    window.addEventListener("rf:auth-change", handleAuthChange);
    return () => {
      window.removeEventListener("rf:auth-change", handleAuthChange);
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
