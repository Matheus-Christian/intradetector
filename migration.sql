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

-- 4. Criar tabela de logs de auditoria (action_logs)
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Evitar erros se a política já existir
DROP POLICY IF EXISTS "Permitir tudo para admin autenticado em logs" ON public.action_logs;
CREATE POLICY "Permitir tudo para admin autenticado em logs" 
ON public.action_logs FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Habilitar Realtime para action_logs
alter publication supabase_realtime add table public.action_logs;

-- 5. Criar função para registrar/sincronizar alertas automáticos de forma atômica
CREATE OR REPLACE FUNCTION public.manage_auto_alert(
  trigger_active BOOLEAN,
  alert_title TEXT,
  alert_desc TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_alerts JSONB;
  updated_alerts JSONB;
  alert_exists BOOLEAN := FALSE;
  item JSONB;
  new_alert JSONB;
BEGIN
  -- 1. Obter alertas atuais
  SELECT value INTO current_alerts FROM public.settings WHERE key = 'network_alerts';
  
  -- Se não existir, inicializa como array vazio
  IF current_alerts IS NULL THEN
    current_alerts := '[]'::jsonb;
  END IF;

  -- 2. Verificar se já existe um alerta automático ativo
  FOR item IN SELECT * FROM jsonb_array_elements(current_alerts) LOOP
    IF (item->>'is_active')::boolean = TRUE AND (item->>'alert_type') = 'Detecção Automática' THEN
      alert_exists := TRUE;
      EXIT;
    END IF;
  END LOOP;

  -- 3. Se trigger_active for TRUE e não houver alerta automático ativo, criamos um novo
  IF trigger_active = TRUE AND alert_exists = FALSE THEN
    new_alert := jsonb_build_object(
      'id', gen_random_uuid(),
      'title', alert_title,
      'alert_type', 'Detecção Automática',
      'description', alert_desc,
      'is_active', TRUE,
      'expires_at', NULL,
      'created_at', timezone('utc'::text, now()),
      'updated_at', timezone('utc'::text, now()),
      'is_auto', TRUE
    );
    
    -- Adicionar o novo alerta no início da lista (histórico decrescente)
    updated_alerts := jsonb_build_array(new_alert) || current_alerts;
    
    INSERT INTO public.settings (key, value, updated_at)
    VALUES ('network_alerts', updated_alerts, timezone('utc'::text, now()))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
    
    RETURN updated_alerts;
  END IF;

  -- 4. Se trigger_active for FALSE e houver alerta automático ativo, marcamos ele como inativo
  IF trigger_active = FALSE AND alert_exists = TRUE THEN
    updated_alerts := '[]'::jsonb;
    
    FOR item IN SELECT * FROM jsonb_array_elements(current_alerts) LOOP
      IF (item->>'is_active')::boolean = TRUE AND (item->>'alert_type') = 'Detecção Automática' THEN
        -- Modificar o alerta para inativo
        item := item || jsonb_build_object('is_active', FALSE, 'updated_at', timezone('utc'::text, now()));
      END IF;
      updated_alerts := updated_alerts || jsonb_build_array(item);
    END LOOP;

    INSERT INTO public.settings (key, value, updated_at)
    VALUES ('network_alerts', updated_alerts, timezone('utc'::text, now()))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
    
    RETURN updated_alerts;
  END IF;

  RETURN current_alerts;
END;
$$;

