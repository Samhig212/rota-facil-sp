import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RotaFacil SP" },
      { name: "description", content: "Gestão de cargas e fechamento diário de frota própria em São Paulo." },
      { property: "og:title", content: "RotaFacil SP" },
      { property: "og:description", content: "Gestão de cargas e fechamento diário de frota própria em São Paulo." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/mapa" });
  },
});
