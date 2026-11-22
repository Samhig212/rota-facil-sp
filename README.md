# 🚚 RotaFácil SP

E aí! Esse aqui é o **RotaFácil SP**, um sistema que desenvolvemos pra facilitar o dia a dia da operação logística e despacho de entregas aqui na Grande São Paulo.

A ideia principal é resolver aquela dor de cabeça de montar rotas: o sistema pega as notas fiscais cadastradas (ou importadas via XML de NF-e), calcula a rota partindo da nossa base no Socorro (Rua Professor Oswaldo Quirino Simões, 142) e organiza a sequência de entrega passando sempre pelo ponto mais próximo do anterior pra economizar combustível e tempo de percurso.

Também tem controle de veículos da frota, cadastro de motoristas com foto e CNH, mapa interativo com Leaflet e fechamento de viagem com registro de KM e devoluções.

---

## 🛠️ O que usamos no projeto

- **Front-end:** React 19, TypeScript, Vite, Tailwind CSS, Leaflet pra renderizar o mapa de entregas, TanStack Router e Query pras rotas e gerenciamento de estado.
- **Back-end:** Python com Flask, Flask-CORS e Gunicorn.
- **Banco de Dados:** MySQL em produção (com fallback automático pra SQLite local pra quem quiser testar sem precisar subir um banco MySQL).

---

## 💻 Como rodar na sua máquina

Pra rodar o projeto localmente você vai precisar de dois terminais: um pro backend e outro pro frontend.

### 1. Rodando a API (Backend)

No primeiro terminal:

```bash
# Entra na pasta do backend
cd backend

# Cria e ativa o ambiente virtual
python -m venv venv

# No Windows:
venv\Scripts\activate
# No Linux/Mac:
source venv/bin/activate

# Instala as dependências e roda o servidor
pip install -r requirements.txt
python app.py
```

Pronto! A API vai estar rodando em `http://localhost:5000`. Se você não tiver um MySQL configurado, relaxa: o próprio Flask cria um arquivo SQLite local (`rota_facil.db`) com os dados iniciais pra você testar na hora.

### 2. Rodando o Front-end (React)

No segundo terminal (na raiz do projeto):

```bash
# Instala as dependências
npm install

# Inicia o Vite
npm run dev
```

O site vai abrir em `http://localhost:3000` (ou na porta que o Vite indicar no terminal).

---

## 🚀 Subindo no Render

O projeto já tá 100% pronto pra deploy no Render!

   ### 1. Criando o Web Service do Backend
   1. No painel do Render, crie um **New Web Service** apontando pro seu repositório do GitHub.
   2. Configure:
      - **Environment:** `Python`
      - **Build Command:** `pip install -r backend/requirements.txt`
      - **Start Command:** `gunicorn --chdir backend app:app` (ou o Render vai ler automaticamente o arquivo `Procfile`)
   3. Nas variáveis de ambiente (**Environment Variables**), adicione:
      - `PORT`: 5000 (ou o Render define sozinho)
      - `ADMIN_TOKEN`: `ADMIN123` (ou o token seguro que você definir para autorizar alterações)
      - `DATABASE_URL` ou `MYSQL_URL` (se for usar o MySQL gerenciado do Render ou Railway). Caso não coloque, ele usa o SQLite local sem problemas.

   ### 2. Criando o Static Site do Frontend
   1. Crie um **New Static Site** apontando pro mesmo repositório.
   2. Configure:
      - **Build Command:** `npm run build`
      - **Publish Directory:** `dist`
   3. Nas variáveis de ambiente do Frontend:
      - `VITE_API_URL`: Coloque a URL do seu backend gerada pelo Render (ex: `https://seu-backend.onrender.com`).
   4. Em **Redirects/Rewrites**:
      - A regra de SPA `/* -> /index.html (Rewrite)` já é aplicada automaticamente pelo arquivo `_redirects` e pelo `render.yaml`, garantindo que atualizar a página (F5) ou acessar rotas diretas nunca resulte em erro 404.

   > 💡 **Dica Rápida:** Você também pode usar a opção **New Blueprint Instance** no Render e selecionar o arquivo `render.yaml` para configurar tanto o Backend quanto o Frontend automaticamente!

---

## 🔐 Autenticação, Isolamento de Espaços e Token do Admin

O sistema possui controle completo de múltiplos operadores com isolamento de dados:
- **Espaço Isolado por Conta:** Cada usuário logado (ex: `sam12@gmail.com` vs `sam13@gmail.com`) enxerga exclusivamente suas próprias notas fiscais e despachos de rotas.
- **Perfil de Gestor / Admin:** Contas com perfil de administrador possuem permissão direta de escrita e visualização geral.
- **Token de Modificação do Admin:** Qualquer operação de alteração (lançamento de NF-e, despacho, cadastro de veículo/motorista) feita por um operador regular exige o token de modificação do administrador (`ADMIN_TOKEN`, padrão: `ADMIN123`). O front-end abre automaticamente a janela para o operador inserir e validar o token caso ainda não o tenha informado.

### Contas de Teste Rápido:
- **Gestor / Admin:** `operacao@rotafacil.com.br` | Senha: `123456` (Acesso direto sem necessidade de token)
- **Operador 1:** `sam12@gmail.com` | Senha: `123456`
- **Operador 2:** `sam13@gmail.com` | Senha: `123456`
- **Token Admin:** `ADMIN123`

---

## 📂 Estrutura das Pastas

```
rota-facil-sp/
├── backend/
│   ├── app.py             # Servidor Flask com as rotas da API
│   ├── requirements.txt   # Pacotes necessários do Python
│   └── schema.sql         # Estrutura do banco de dados MySQL
├── public/                # Ícone do site (caminhão de entrega) e estáticos
├── src/
│   ├── components/        # Componentes visuais e o mapa Leaflet
│   ├── lib/               # Lógica de cálculo de rotas (Haversine), API e tipos
│   └── routes/            # Telas do sistema (Mapa, Despacho, NF-e, Fechamento, etc.)
├── Procfile               # Instrução de boot pro deploy
└── vite.config.ts         # Configuração do Vite e Tailwind
```
