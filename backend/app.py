import os
import uuid
import datetime
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Carrega variáveis de ambiente do .env se existir
load_dotenv()

app = Flask(__name__)
# Habilita CORS para permitir que o front-end React consuma a API livremente
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("RotaFacilAPI")

# ==============================================================================
# CONFIGURAÇÃO DE BANCO DE DADOS (MySQL com Fallback Seguro para SQLite)
# ==============================================================================
MYSQL_URL = os.environ.get("MYSQL_URL") or os.environ.get("DATABASE_URL")
MYSQL_HOST = os.environ.get("MYSQL_HOST")
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DB", "rota_facil_sp")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", 3306))

USE_MYSQL = False
mysql_conn_params = {}

if MYSQL_URL:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(MYSQL_URL)
        mysql_conn_params = {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 3306,
            "user": parsed.username or "root",
            "password": parsed.password or "",
            "database": (parsed.path or "/rota_facil_sp").lstrip("/"),
        }
        USE_MYSQL = True
    except Exception as e:
        logger.warning(f"Falha ao interpretar MYSQL_URL: {e}")

if not USE_MYSQL and MYSQL_HOST:
    mysql_conn_params = {
        "host": MYSQL_HOST,
        "port": MYSQL_PORT,
        "user": MYSQL_USER,
        "password": MYSQL_PASSWORD,
        "database": MYSQL_DB,
    }
    USE_MYSQL = True

def get_db_connection():
    """
    Retorna uma conexão ativa com MySQL se configurado,
    ou SQLite local (backend/rota_facil.db) como fallback resiliente.
    """
    if USE_MYSQL:
        try:
            import pymysql
            from pymysql.cursors import DictCursor
            conn = pymysql.connect(
                host=mysql_conn_params.get("host", "localhost"),
                port=mysql_conn_params.get("port", 3306),
                user=mysql_conn_params.get("user", "root"),
                password=mysql_conn_params.get("password", ""),
                database=mysql_conn_params.get("database", "rota_facil_sp"),
                cursorclass=DictCursor,
                autocommit=True,
                charset="utf8mb4"
            )
            return conn, "mysql"
        except Exception as e:
            logger.warning(f"Não foi possível conectar ao MySQL ({e}). Utilizando SQLite local.")

    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "rota_facil.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn, "sqlite"

def execute_query(query, params=None, fetch="all"):
    conn, engine = get_db_connection()
    try:
        cursor = conn.cursor()
        if engine == "sqlite":
            # Converte marcadores %s do MySQL para ? do SQLite
            q_formatted = query.replace("%s", "?")
            cursor.execute(q_formatted, params or ())
            if fetch == "all":
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
            elif fetch == "one":
                row = cursor.fetchone()
                return dict(row) if row else None
            else:
                conn.commit()
                return cursor.rowcount
        else:
            cursor.execute(query, params or ())
            if fetch == "all":
                return cursor.fetchall()
            elif fetch == "one":
                return cursor.fetchone()
            else:
                return cursor.rowcount
    finally:
        conn.close()

def init_db():
    """Cria as tabelas necessárias e popula dados iniciais da frota."""
    conn, engine = get_db_connection()
    try:
        cursor = conn.cursor()
        text_type = "TEXT" if engine == "sqlite" else "LONGTEXT"
        timestamp_default = "CURRENT_TIMESTAMP"

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(150) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            nome VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT {timestamp_default}
        )
        """)

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS vehicles (
            id VARCHAR(36) PRIMARY KEY,
            placa VARCHAR(10) UNIQUE NOT NULL,
            modelo VARCHAR(100) DEFAULT '',
            km_atual INT DEFAULT 0,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT {timestamp_default}
        )
        """)

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS drivers (
            id VARCHAR(36) PRIMARY KEY,
            nome VARCHAR(150) NOT NULL,
            cnh VARCHAR(30) DEFAULT '',
            telefone VARCHAR(30) DEFAULT '',
            foto {text_type},
            cnh_foto {text_type},
            cnh_categoria VARCHAR(10) DEFAULT 'B',
            cnh_validade VARCHAR(30) DEFAULT '',
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT {timestamp_default}
        )
        """)

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS routes (
            id VARCHAR(36) PRIMARY KEY,
            vehicle_id VARCHAR(36) NOT NULL,
            driver_id VARCHAR(36) NOT NULL,
            data VARCHAR(15) NOT NULL,
            km_inicial INT DEFAULT 0,
            km_final INT DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'aberta',
            closed_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT {timestamp_default}
        )
        """)

        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS invoices (
            id VARCHAR(36) PRIMARY KEY,
            numero VARCHAR(50) NOT NULL,
            serie VARCHAR(20) DEFAULT '1',
            chave VARCHAR(100) DEFAULT '',
            destinatario VARCHAR(200) NOT NULL,
            cep VARCHAR(15) NOT NULL,
            logradouro VARCHAR(200) DEFAULT '',
            numero_endereco VARCHAR(50) DEFAULT '',
            bairro VARCHAR(100) DEFAULT '',
            cidade VARCHAR(100) DEFAULT 'São Paulo',
            valor DECIMAL(12,2) DEFAULT 0.00,
            volumes INT DEFAULT 1,
            lat DOUBLE DEFAULT NULL,
            lng DOUBLE DEFAULT NULL,
            status VARCHAR(30) DEFAULT 'pendente',
            motivo_devolucao TEXT,
            route_id VARCHAR(36) DEFAULT NULL,
            ordem INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT {timestamp_default}
        )
        """)

        if engine == "sqlite":
            conn.commit()

        # Seed inicial caso não existam veículos
        cursor.execute("SELECT COUNT(*) as cnt FROM vehicles")
        v_count = cursor.fetchone()
        count_val = v_count["cnt"] if isinstance(v_count, dict) else v_count[0]

        if count_val == 0:
            logger.info("Populando dados iniciais de demonstração...")
            # Veículos
            seed_vehicles = [
                (str(uuid.uuid4()), "FRT-1A23", "Fiat Fiorino 1.4", 48210, 1),
                (str(uuid.uuid4()), "SPX-4B56", "VW Delivery 9.170", 112540, 1),
                (str(uuid.uuid4()), "ROT-7C89", "Renault Master Chassi", 76300, 1),
            ]
            for v in seed_vehicles:
                execute_query("INSERT INTO vehicles (id, placa, modelo, km_atual, ativo) VALUES (%s, %s, %s, %s, %s)", v, fetch=None)

            # Motoristas com CNH e Foto
            seed_drivers = [
                (
                    str(uuid.uuid4()),
                    "Carlos Mendes",
                    "04512398712",
                    "(11) 98877-1122",
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
                    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
                    "D",
                    "2028-05-15",
                    1
                ),
                (
                    str(uuid.uuid4()),
                    "Ana Ribeiro",
                    "09876543210",
                    "(11) 97766-3344",
                    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
                    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
                    "B",
                    "2027-11-20",
                    1
                ),
                (
                    str(uuid.uuid4()),
                    "João Pereira",
                    "01234567890",
                    "(11) 96655-5566",
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
                    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
                    "E",
                    "2029-02-10",
                    1
                ),
            ]
            for d in seed_drivers:
                execute_query("INSERT INTO drivers (id, nome, cnh, telefone, foto, cnh_foto, cnh_categoria, cnh_validade, ativo) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", d, fetch=None)

            # Usuário administrador
            execute_query("INSERT INTO users (id, email, password, nome) VALUES (%s, %s, %s, %s)",
                          (str(uuid.uuid4()), "operacao@rotafacil.com.br", "123456", "Gestor de Frotas SP"), fetch=None)

            # Notas de exemplo na Grande SP
            seed_invoices = [
                (str(uuid.uuid4()), "10421", "1", "352601000104210001", "Mercado da Vila Ltda", "04775010", "Rua Olavo Bilac", "150", "Socorro", "São Paulo", 1450.00, 4, -23.6845, -46.7032, "pendente"),
                (str(uuid.uuid4()), "10422", "1", "352601000104220002", "Distribuidora Santo Amaro", "04753000", "Avenida Washington Luís", "2100", "Santo Amaro", "São Paulo", 3280.50, 8, -23.6550, -46.6980, "pendente"),
                (str(uuid.uuid4()), "10423", "1", "352601000104230003", "Auto Peças Interlagos", "04776000", "Avenida Interlagos", "3500", "Interlagos", "São Paulo", 890.00, 2, -23.6910, -46.6870, "pendente"),
                (str(uuid.uuid4()), "10424", "1", "352601000104240004", "Empório Morumbi Gourmet", "05705000", "Rua Doutor Fonseca Brasil", "420", "Vila Andrade", "São Paulo", 4120.00, 12, -23.6280, -46.7240, "pendente"),
            ]
            for inv in seed_invoices:
                execute_query("INSERT INTO invoices (id, numero, serie, chave, destinatario, cep, logradouro, numero_endereco, bairro, cidade, valor, volumes, lat, lng, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", inv, fetch=None)

    finally:
        conn.close()

# Executa migrações/inicialização do banco
init_db()

# ==============================================================================
# ROTAS DA API
# ==============================================================================

@app.route("/api/health", methods=["GET"])
def health():
    _, engine = get_db_connection()
    return jsonify({
        "status": "online",
        "service": "RotaFacil SP API",
        "database_engine": engine,
        "base_operacional": "Rua Professor Oswaldo Quirino Simões, 142 - Socorro / SP",
        "timestamp": datetime.datetime.now().isoformat()
    })

# --- AUTENTICAÇÃO ---

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    user = execute_query("SELECT id, email, nome FROM users WHERE email = %s AND password = %s", (email, password), fetch="one")
    if not user:
        # Se for o login demonstrativo ou primeiro acesso, aceita ou auto-cadastra
        if email:
            new_id = str(uuid.uuid4())
            nome = email.split("@")[0].capitalize()
            execute_query("INSERT INTO users (id, email, password, nome) VALUES (%s, %s, %s, %s)", (new_id, email, password, nome), fetch=None)
            user = {"id": new_id, "email": email, "nome": nome}
        else:
            return jsonify({"error": "Credenciais inválidas"}), 401

    token = f"rf_session_{user['id']}"
    return jsonify({
        "user": user,
        "token": token,
        "message": "Autenticado com sucesso"
    })

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "E-mail e senha são obrigatórios"}), 400

    existing = execute_query("SELECT id FROM users WHERE email = %s", (email,), fetch="one")
    if existing:
        return jsonify({"error": "E-mail já cadastrado"}), 409

    user_id = str(uuid.uuid4())
    nome = email.split("@")[0].capitalize()
    execute_query("INSERT INTO users (id, email, password, nome) VALUES (%s, %s, %s, %s)", (user_id, email, password, nome), fetch=None)
    
    return jsonify({
        "user": {"id": user_id, "email": email, "nome": nome},
        "token": f"rf_session_{user_id}",
        "message": "Operador registrado com sucesso"
    }), 201

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token or not token.startswith("rf_session_"):
        # Retorna o primeiro usuário ativo ou demo para fluidez
        user = execute_query("SELECT id, email, nome FROM users LIMIT 1", fetch="one")
        if user:
            return jsonify({"user": user})
        return jsonify({"user": {"id": "demo-user", "email": "operacao@rotafacil.com.br", "nome": "Operador Logístico"}})

    user_id = token.replace("rf_session_", "")
    user = execute_query("SELECT id, email, nome FROM users WHERE id = %s", (user_id,), fetch="one")
    if user:
        return jsonify({"user": user})
    return jsonify({"user": {"id": user_id, "email": "operador@rotafacil.com.br", "nome": "Operador Logístico"}})

# --- VEÍCULOS ---

@app.route("/api/vehicles", methods=["GET"])
def list_vehicles():
    vehicles = execute_query("SELECT * FROM vehicles ORDER BY placa ASC")
    return jsonify(vehicles)

@app.route("/api/vehicles", methods=["POST"])
def create_vehicle():
    data = request.get_json() or {}
    placa = data.get("placa", "").strip().upper()
    modelo = data.get("modelo", "").strip()
    km_atual = int(data.get("km_atual") or 0)

    if not placa:
        return jsonify({"error": "Placa é obrigatória"}), 400

    v_id = str(uuid.uuid4())
    try:
        execute_query("INSERT INTO vehicles (id, placa, modelo, km_atual, ativo) VALUES (%s, %s, %s, %s, %s)",
                      (v_id, placa, modelo, km_atual, 1), fetch=None)
        created = execute_query("SELECT * FROM vehicles WHERE id = %s", (v_id,), fetch="one")
        return jsonify(created), 201
    except Exception as e:
        return jsonify({"error": f"Erro ao criar veículo: {str(e)}"}), 400

@app.route("/api/vehicles/<v_id>", methods=["PATCH"])
def update_vehicle(v_id):
    data = request.get_json() or {}
    fields = []
    values = []

    for k in ["placa", "modelo", "km_atual", "ativo"]:
        if k in data:
            fields.append(f"{k} = %s")
            val = data[k]
            if k == "placa": val = str(val).upper()
            if k == "ativo": val = 1 if val else 0
            values.append(val)

    if not fields:
        return jsonify({"error": "Nenhum campo fornecido para atualização"}), 400

    values.append(v_id)
    execute_query(f"UPDATE vehicles SET {', '.join(fields)} WHERE id = %s", tuple(values), fetch=None)
    updated = execute_query("SELECT * FROM vehicles WHERE id = %s", (v_id,), fetch="one")
    return jsonify(updated)

# --- MOTORISTAS (COM FOTO E CNH) ---

@app.route("/api/drivers", methods=["GET"])
def list_drivers():
    drivers = execute_query("SELECT * FROM drivers ORDER BY nome ASC")
    return jsonify(drivers)

@app.route("/api/drivers", methods=["POST"])
def create_driver():
    data = request.get_json() or {}
    nome = data.get("nome", "").strip()
    cnh = data.get("cnh", "").strip()
    telefone = data.get("telefone", "").strip()
    foto = data.get("foto")
    cnh_foto = data.get("cnh_foto")
    cnh_categoria = data.get("cnh_categoria", "B")
    cnh_validade = data.get("cnh_validade", "")

    if not nome:
        return jsonify({"error": "Nome do motorista é obrigatório"}), 400

    d_id = str(uuid.uuid4())
    execute_query(
        """
        INSERT INTO drivers (id, nome, cnh, telefone, foto, cnh_foto, cnh_categoria, cnh_validade, ativo)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
        """,
        (d_id, nome, cnh, telefone, foto, cnh_foto, cnh_categoria, cnh_validade),
        fetch=None
    )
    created = execute_query("SELECT * FROM drivers WHERE id = %s", (d_id,), fetch="one")
    return jsonify(created), 201

@app.route("/api/drivers/<d_id>", methods=["PATCH"])
def update_driver(d_id):
    data = request.get_json() or {}
    fields = []
    values = []

    for k in ["nome", "cnh", "telefone", "foto", "cnh_foto", "cnh_categoria", "cnh_validade", "ativo"]:
        if k in data:
            fields.append(f"{k} = %s")
            val = data[k]
            if k == "ativo": val = 1 if val else 0
            values.append(val)

    if not fields:
        return jsonify({"error": "Nenhum campo fornecido"}), 400

    values.append(d_id)
    execute_query(f"UPDATE drivers SET {', '.join(fields)} WHERE id = %s", tuple(values), fetch=None)
    updated = execute_query("SELECT * FROM drivers WHERE id = %s", (d_id,), fetch="one")
    return jsonify(updated)

# --- NOTAS FISCAIS (INVOICES) ---

@app.route("/api/invoices", methods=["GET"])
def list_invoices():
    invoices = execute_query("SELECT * FROM invoices ORDER BY created_at DESC")
    # Converte tipos decimais e booleanos para compatibilidade com json
    for inv in invoices:
        if "valor" in inv and inv["valor"] is not None:
            inv["valor"] = float(inv["valor"])
    return jsonify(invoices)

@app.route("/api/invoices", methods=["POST"])
def create_invoice():
    data = request.get_json() or {}
    inv_id = str(uuid.uuid4())
    numero = data.get("numero", "").strip()
    serie = data.get("serie", "1").strip()
    chave = data.get("chave", "").strip()
    destinatario = data.get("destinatario", "").strip()
    cep = data.get("cep", "").strip()
    logradouro = data.get("logradouro", "").strip()
    numero_endereco = data.get("numero_endereco", "").strip()
    bairro = data.get("bairro", "").strip()
    cidade = data.get("cidade", "São Paulo").strip()
    valor = float(data.get("valor") or 0.0)
    volumes = int(data.get("volumes") or 1)
    lat = float(data["lat"]) if data.get("lat") is not None else None
    lng = float(data["lng"]) if data.get("lng") is not None else None

    if not numero or not destinatario or not cep:
        return jsonify({"error": "Número, Destinatário e CEP são obrigatórios"}), 400

    execute_query(
        """
        INSERT INTO invoices (id, numero, serie, chave, destinatario, cep, logradouro, numero_endereco, bairro, cidade, valor, volumes, lat, lng, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pendente')
        """,
        (inv_id, numero, serie, chave, destinatario, cep, logradouro, numero_endereco, bairro, cidade, valor, volumes, lat, lng),
        fetch=None
    )
    created = execute_query("SELECT * FROM invoices WHERE id = %s", (inv_id,), fetch="one")
    if created and "valor" in created: created["valor"] = float(created["valor"])
    return jsonify(created), 201

@app.route("/api/invoices/batch", methods=["POST"])
def create_invoices_batch():
    data = request.get_json() or []
    if isinstance(data, dict):
        data = data.get("invoices", [])

    inserted = []
    for item in data:
        inv_id = str(uuid.uuid4())
        val = float(item.get("valor") or 0.0)
        vols = int(item.get("volumes") or 1)
        lat = float(item["lat"]) if item.get("lat") is not None else None
        lng = float(item["lng"]) if item.get("lng") is not None else None

        execute_query(
            """
            INSERT INTO invoices (id, numero, serie, chave, destinatario, cep, logradouro, numero_endereco, bairro, cidade, valor, volumes, lat, lng, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pendente')
            """,
            (
                inv_id,
                item.get("numero", ""),
                item.get("serie", "1"),
                item.get("chave", ""),
                item.get("destinatario", ""),
                item.get("cep", ""),
                item.get("logradouro", ""),
                item.get("numero_endereco", ""),
                item.get("bairro", ""),
                item.get("cidade", "São Paulo"),
                val,
                vols,
                lat,
                lng,
            ),
            fetch=None
        )
        inserted.append(inv_id)

    return jsonify({"count": len(inserted), "ids": inserted}), 201

@app.route("/api/invoices/<inv_id>", methods=["PATCH"])
def update_invoice(inv_id):
    data = request.get_json() or {}
    fields = []
    values = []

    for k in ["status", "route_id", "ordem", "motivo_devolucao", "lat", "lng"]:
        if k in data:
            fields.append(f"{k} = %s")
            values.append(data[k])

    if not fields:
        return jsonify({"error": "Nenhum campo fornecido"}), 400

    values.append(inv_id)
    execute_query(f"UPDATE invoices SET {', '.join(fields)} WHERE id = %s", tuple(values), fetch=None)
    updated = execute_query("SELECT * FROM invoices WHERE id = %s", (inv_id,), fetch="one")
    if updated and "valor" in updated: updated["valor"] = float(updated["valor"])
    return jsonify(updated)

@app.route("/api/invoices/<inv_id>", methods=["DELETE"])
def delete_invoice(inv_id):
    execute_query("DELETE FROM invoices WHERE id = %s", (inv_id,), fetch=None)
    return jsonify({"deleted": True, "id": inv_id})

# --- ROTAS & DESPACHO ---

@app.route("/api/routes", methods=["GET"])
def list_routes():
    routes = execute_query("SELECT * FROM routes ORDER BY created_at DESC")
    # Realiza o join com veículos e motoristas
    result = []
    for r in routes:
        v = execute_query("SELECT placa, modelo FROM vehicles WHERE id = %s", (r["vehicle_id"],), fetch="one")
        d = execute_query("SELECT nome FROM drivers WHERE id = %s", (r["driver_id"],), fetch="one")
        r_dict = dict(r)
        r_dict["vehicles"] = v
        r_dict["drivers"] = d
        result.append(r_dict)
    return jsonify(result)

@app.route("/api/routes", methods=["POST"])
def create_route():
    data = request.get_json() or {}
    v_id = data.get("vehicle_id")
    d_id = data.get("driver_id")
    km_inicial = int(data.get("km_inicial") or 0)
    hoje = datetime.date.today().isoformat()
    r_id = str(uuid.uuid4())

    if not v_id or not d_id:
        return jsonify({"error": "Veículo e motorista são obrigatórios"}), 400

    execute_query(
        "INSERT INTO routes (id, vehicle_id, driver_id, data, km_inicial, status) VALUES (%s, %s, %s, %s, %s, 'aberta')",
        (r_id, v_id, d_id, hoje, km_inicial),
        fetch=None
    )
    created = execute_query("SELECT * FROM routes WHERE id = %s", (r_id,), fetch="one")
    return jsonify(created), 201

@app.route("/api/routes/<r_id>/close", methods=["POST", "PATCH"])
def close_route(r_id):
    data = request.get_json() or {}
    km_final = int(data.get("km_final") or 0)
    now = datetime.datetime.now().isoformat()

    route = execute_query("SELECT * FROM routes WHERE id = %s", (r_id,), fetch="one")
    if not route:
        return jsonify({"error": "Rota não encontrada"}), 404

    execute_query(
        "UPDATE routes SET status = 'fechada', km_final = %s, closed_at = %s WHERE id = %s",
        (km_final, now, r_id),
        fetch=None
    )
    # Atualiza KM do veículo
    execute_query("UPDATE vehicles SET km_atual = %s WHERE id = %s", (km_final, route["vehicle_id"]), fetch=None)

    updated = execute_query("SELECT * FROM routes WHERE id = %s", (r_id,), fetch="one")
    return jsonify(updated)

# ==============================================================================
# INICIALIZAÇÃO DO SERVIDOR COM SUPORTE A PORTA DINÂMICA
# ==============================================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    logger.info(f"Iniciando RotaFacil Flask API na porta {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)
