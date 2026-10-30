CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text NOT NULL UNIQUE,
  modelo text NOT NULL DEFAULT '',
  km_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnh text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  data date NOT NULL DEFAULT current_date,
  km_inicial integer NOT NULL DEFAULT 0,
  km_final integer,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  serie text NOT NULL DEFAULT '1',
  chave text NOT NULL DEFAULT '',
  destinatario text NOT NULL,
  cep text NOT NULL,
  logradouro text NOT NULL DEFAULT '',
  numero_endereco text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  volumes integer NOT NULL DEFAULT 1,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_rota','entregue','devolvida')),
  motivo_devolucao text,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  ordem integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles, public.drivers, public.routes, public.invoices TO authenticated;
GRANT ALL ON public.vehicles, public.drivers, public.routes, public.invoices TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe vehicles" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "equipe drivers" ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "equipe routes" ON public.routes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "equipe invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.vehicles (placa, modelo, km_atual) VALUES ('FRT-1A23','Fiat Fiorino',48210),('SPX-4B56','VW Delivery 9.170',112540),('ROT-7C89','Renault Master',76300);
INSERT INTO public.drivers (nome, cnh, telefone) VALUES ('Carlos Mendes','04512398712','(11) 98877-1122'),('Ana Ribeiro','09876543210','(11) 97766-3344'),('João Pereira','01234567890','(11) 96655-5566');