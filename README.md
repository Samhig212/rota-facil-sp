# RotaFacil SP — Gestão de Frota & Logística Estratégica

Sistema corporativo e independente para gestão operacional de frota própria, roteirização estratégica por proximidade, controle de condutores com CNH/foto e fechamento diário de viagens.

---

## 🚀 Arquitetura do Sistema

* **Front-end:** React 19, TypeScript, Vite, Tailwind CSS, Leaflet Maps, TanStack Query & Router.
* **Back-end:** Python 3, Flask, Flask-CORS, Gunicorn.
* **Banco de Dados:** MySQL (compatível com MySQL 8, MariaDB, AWS RDS, Render e Railway), com fallback automático para SQLite local.
* **Ponto de Partida Oficial:** Rua Professor Oswaldo Quirino Simões, 142 – Socorro / SP.

---

## 📂 Estrutura do Repositório

```
rota-facil-sp/
├── backend/
│   ├── app.py             # Servidor Flask com endpoints REST e suporte a porta dinâmica
│   ├── requirements.txt   # Dependências Python (Flask, PyMySQL, Gunicorn, etc.)
│   ├── schema.sql         # Script de criação de tabelas e seeds para MySQL
│   └── .env.example       # Modelo de variáveis de ambiente do backend
├── src/
│   ├── components/        # Componentes visuais e mapas Leaflet
│   ├── lib/
│   │   ├── api.ts         # Cliente HTTP unificado usando VITE_API_URL
│   │   ├── geo.ts         # Base (R. Prof. Oswaldo Quirino Simões) e Rota Estratégica
│   │   ├── fleet.ts       # Consultas de veículos, motoristas e rotas
│   │   └── driver-profiles.ts # Gestão de fotos e via digital da CNH
│   └── routes/            # Telas: Mapa, Lançamento de NF-e, Despacho, Fechamento e Cadastros
├── Procfile               # Arquivo de inicialização para deploy no Render/Railway
├── .env.example           # Modelo de variáveis de ambiente do front-end
├── package.json           # Dependências e scripts do React/Vite
└── vite.config.ts         # Configuração independente do Vite
```

---

## ⚙️ Como Executar Localmente

### 1. Iniciar o Back-end (Python Flask)

```bash
cd backend
python -m venv venv
# No Windows:
venv\Scripts\activate
# No Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

* O backend será iniciado em: `http://localhost:5000`
* Caso não tenha um servidor MySQL rodando localmente, o Flask inicializará automaticamente um banco SQLite em `backend/rota_facil.db` com dados de demonstração.

### 2. Iniciar o Front-end (React + Vite)

Em outro terminal na raiz do projeto:

```bash
# Copie o arquivo de variáveis de ambiente
cp .env.example .env

# Instale as dependências
npm install # ou bun install / pnpm install

# Inicie o servidor de desenvolvimento
npm run dev
```

* O frontend será iniciado em: `http://localhost:3000`

---

## 🌐 Deploy em Produção (Render / Railway)

O projeto possui o arquivo `Procfile` configurado para execução com **Gunicorn**:

```procfile
web: gunicorn --chdir backend app:app
```

### Variáveis de Ambiente no Deploy:

* **No Backend (Web Service Python):**
  * `PORT`: Configurado automaticamente pela plataforma.
  * `MYSQL_URL` ou `DATABASE_URL`: URL do banco de dados MySQL disponibilizado na nuvem.
* **No Frontend (Static Site ou Node Service):**
  * `VITE_API_URL`: URL do seu backend em produção (ex: `https://rotafacil-api.onrender.com`).
