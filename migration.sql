-- 1. Tornar colunas legadas opcionais (nullable)
ALTER TABLE public.reports ALTER COLUMN region DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN connection_type DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN issue_type DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN device DROP NOT NULL;

-- 2. Adicionar coluna custom_fields JSONB
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 3. Inserir o form_schema padrão com os 4 campos convertidos em dinâmicos
INSERT INTO public.settings (key, value) VALUES
('form_schema', '[
  {
    "id": "region",
    "label": "Região Afetada",
    "type": "select",
    "required": true,
    "options": ["São Paulo (SP)", "Rio de Janeiro (RJ)", "Minas Gerais (MG)", "Distrito Federal (DF)", "Paraná (PR)", "Rio Grande do Sul (RS)", "Bahia (BA)", "Ceará (CE)", "Pernambuco (PE)", "Santa Catarina (SC)"]
  },
  {
    "id": "connection_type",
    "label": "Meio de Transmissão",
    "type": "select",
    "required": true,
    "options": ["Cabo (Ethernet)", "Wi-Fi (5GHz/6GHz)", "Wi-Fi (2.4GHz)", "Dados Móveis (4G/5G)", "PPPoE Fibra", "Satélite"]
  },
  {
    "id": "issue_type",
    "label": "Problema Enfrentado",
    "type": "select",
    "required": true,
    "options": ["Lentidão de navegação", "Perda de pacotes (Packet Loss)", "Latência alta (Ping alto)", "Queda total da internet", "IPTV travando / Sem sinal"]
  },
  {
    "id": "device",
    "label": "Dispositivo",
    "type": "select",
    "required": true,
    "options": ["Celular (Smartphone)", "PC / Notebook", "Smart TV / TV Box", "Videogame (Console)", "Roteador"]
  }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
