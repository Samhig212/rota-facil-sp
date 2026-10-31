# RotaFacil SP - Diretrizes de Desenvolvimento

## Arquitetura do Projeto
- **Front-end**: React 19, Vite, TanStack Router/Query, Tailwind CSS, Leaflet Maps.
- **Back-end**: Python Flask com `flask-cors`, porta dinâmica (`PORT`), pronto para deploy no Render/Railway.
- **Banco de Dados**: MySQL (com fallback para SQLite em desenvolvimento local).
- **Comunicação**: HTTP REST com suporte à variável `VITE_API_URL`.
