-- ==============================================================================
-- SCHEMA MYSQL - ROTA FACIL SP (GESTÃO DE FROTA & LOGÍSTICA URBANA)
-- Base Operacional: Rua Professor Oswaldo Quirino Simões, 142 - Socorro / SP
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `rota_facil_sp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rota_facil_sp`;

-- 1. TABELA DE USUÁRIOS E OPERADORES DO SISTEMA
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `nome` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABELA DE VEÍCULOS DA FROTA
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `placa` VARCHAR(10) NOT NULL UNIQUE,
  `modelo` VARCHAR(100) NOT NULL DEFAULT '',
  `km_atual` INT NOT NULL DEFAULT 0,
  `ativo` BOOLEAN NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABELA DE MOTORISTAS (COM FOTO E DOCUMENTO CNH)
CREATE TABLE IF NOT EXISTS `drivers` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `nome` VARCHAR(150) NOT NULL,
  `cnh` VARCHAR(30) NOT NULL DEFAULT '',
  `telefone` VARCHAR(30) NOT NULL DEFAULT '',
  `foto` LONGTEXT DEFAULT NULL,
  `cnh_foto` LONGTEXT DEFAULT NULL,
  `cnh_categoria` VARCHAR(10) NOT NULL DEFAULT 'B',
  `cnh_validade` VARCHAR(30) DEFAULT '',
  `ativo` BOOLEAN NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABELA DE ROTAS E DESPACHO
CREATE TABLE IF NOT EXISTS `routes` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `driver_id` VARCHAR(36) NOT NULL,
  `data` VARCHAR(15) NOT NULL,
  `km_inicial` INT NOT NULL DEFAULT 0,
  `km_final` INT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aberta',
  `closed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_routes_vehicle` (`vehicle_id`),
  INDEX `idx_routes_driver` (`driver_id`),
  CONSTRAINT `fk_routes_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_routes_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABELA DE NOTAS FISCAIS ELETRÔNICAS (INVOICES)
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `numero` VARCHAR(50) NOT NULL,
  `serie` VARCHAR(20) NOT NULL DEFAULT '1',
  `chave` VARCHAR(100) NOT NULL DEFAULT '',
  `destinatario` VARCHAR(200) NOT NULL,
  `cep` VARCHAR(15) NOT NULL,
  `logradouro` VARCHAR(200) NOT NULL DEFAULT '',
  `numero_endereco` VARCHAR(50) NOT NULL DEFAULT '',
  `bairro` VARCHAR(100) NOT NULL DEFAULT '',
  `cidade` VARCHAR(100) NOT NULL DEFAULT 'São Paulo',
  `valor` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `volumes` INT NOT NULL DEFAULT 1,
  `lat` DOUBLE DEFAULT NULL,
  `lng` DOUBLE DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pendente',
  `motivo_devolucao` TEXT DEFAULT NULL,
  `route_id` VARCHAR(36) DEFAULT NULL,
  `ordem` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_invoices_route` (`route_id`),
  INDEX `idx_invoices_status` (`status`),
  CONSTRAINT `fk_invoices_route` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABELA DE MANUTENÇÃO & VISTORIA PREVENTIVA DE VEÍCULOS
CREATE TABLE IF NOT EXISTS `vehicle_maintenances` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `vehicle_id` VARCHAR(36) NOT NULL,
  `tipo` VARCHAR(50) NOT NULL DEFAULT 'oleo_filtros',
  `descricao` VARCHAR(255) NOT NULL,
  `km_registro` INT NOT NULL DEFAULT 0,
  `km_proxima` INT DEFAULT NULL,
  `intervalo_km` INT DEFAULT NULL,
  `data_registro` VARCHAR(20) NOT NULL,
  `data_validade_vistoria` VARCHAR(20) DEFAULT NULL,
  `custo` DECIMAL(10,2) DEFAULT NULL,
  `oficina` VARCHAR(150) DEFAULT NULL,
  `observacoes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_maint_vehicle` (`vehicle_id`),
  CONSTRAINT `fk_maint_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABELA DE DOCUMENTOS DIGITALIZADOS (PDF / DANFE / CANHOTO / PASTA)
CREATE TABLE IF NOT EXISTS `invoice_documents` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `invoice_id` VARCHAR(36) NOT NULL,
  `tipo` VARCHAR(50) NOT NULL DEFAULT 'danfe',
  `nome_arquivo` VARCHAR(255) NOT NULL,
  `caminho_pasta` VARCHAR(500) DEFAULT NULL,
  `url_data` LONGTEXT DEFAULT NULL,
  `tamanho_bytes` INT DEFAULT NULL,
  `observacoes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doc_invoice` (`invoice_id`),
  CONSTRAINT `fk_doc_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- DADOS INICIAIS DE DEMONSTRAÇÃO (SEED)
-- ==============================================================================

INSERT IGNORE INTO `vehicles` (`id`, `placa`, `modelo`, `km_atual`, `ativo`) VALUES
  ('v-001', 'FRT-1A23', 'Fiat Fiorino 1.4', 48210, 1),
  ('v-002', 'SPX-4B56', 'VW Delivery 9.170', 112540, 1),
  ('v-003', 'ROT-7C89', 'Renault Master Chassi', 76300, 1);

INSERT IGNORE INTO `drivers` (`id`, `nome`, `cnh`, `telefone`, `foto`, `cnh_foto`, `cnh_categoria`, `cnh_validade`, `ativo`) VALUES
  ('d-001', 'Carlos Mendes', '04512398712', '(11) 98877-1122',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
   'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
   'D', '2028-05-15', 1),
  ('d-002', 'Ana Ribeiro', '09876543210', '(11) 97766-3344',
   'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
   'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
   'B', '2027-11-20', 1),
  ('d-003', 'João Pereira', '01234567890', '(11) 96655-5566',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
   'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
   'E', '2029-02-10', 1);

INSERT IGNORE INTO `users` (`id`, `email`, `password`, `nome`) VALUES
  ('u-001', 'operacao@rotafacil.com.br', '123456', 'Gestor de Frotas SP');

INSERT IGNORE INTO `invoices` (`id`, `numero`, `serie`, `chave`, `destinatario`, `cep`, `logradouro`, `numero_endereco`, `bairro`, `cidade`, `valor`, `volumes`, `lat`, `lng`, `status`) VALUES
  ('inv-001', '10421', '1', '352601000104210001', 'Mercado da Vila Ltda', '04775010', 'Rua Olavo Bilac', '150', 'Socorro', 'São Paulo', 1450.00, 4, -23.6845, -46.7032, 'pendente'),
  ('inv-002', '10422', '1', '352601000104220002', 'Distribuidora Santo Amaro', '04753000', 'Avenida Washington Luís', '2100', 'Santo Amaro', 'São Paulo', 3280.50, 8, -23.6550, -46.6980, 'pendente'),
  ('inv-003', '10423', '1', '352601000104230003', 'Auto Peças Interlagos', '04776000', 'Avenida Interlagos', '3500', 'Interlagos', 'São Paulo', 890.00, 2, -23.6910, -46.6870, 'pendente'),
  ('inv-004', '10424', '1', '352601000104240004', 'Empório Morumbi Gourmet', '05705000', 'Rua Doutor Fonseca Brasil', '420', 'Vila Andrade', 'São Paulo', 4120.00, 12, -23.6280, -46.7240, 'pendente');
