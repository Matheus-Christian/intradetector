-- ========================================================
-- INTRADETECTOR - SCHEMA COMPLETO E MIGRACAO DE DADOS
-- Gerado em: 2026-06-10T01:50:39.470Z
-- Servidor de origem (USA) -> Servidor de destino (Brasil)
-- ========================================================

-- --------------------------------------------------------
-- 1. CRIAÇÃO DAS TABELAS
-- --------------------------------------------------------

-- Serviços
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    icon_name TEXT,
    ping_enabled BOOLEAN DEFAULT FALSE,
    ping_address TEXT DEFAULT '',
    ping_interval INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Relatos (reports)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    region TEXT,
    connection_type TEXT,
    issue_type TEXT,
    device TEXT,
    tests_done TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb
);

-- Configurações (settings)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Logs de Auditoria (action_logs)
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- --------------------------------------------------------
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- 3. CRIAÇÃO DAS POLÍTICAS DE ACESSO (RLS Policies)
-- --------------------------------------------------------

-- Serviços
DROP POLICY IF EXISTS "Permitir leitura pública de serviços" ON public.services;
CREATE POLICY "Permitir leitura pública de serviços" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir tudo para admin autenticado em serviços" ON public.services;
CREATE POLICY "Permitir tudo para admin autenticado em serviços" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Relatos (reports)
DROP POLICY IF EXISTS "Permitir leitura pública de relatos" ON public.reports;
CREATE POLICY "Permitir leitura pública de relatos" ON public.reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública de relatos" ON public.reports;
CREATE POLICY "Permitir inserção pública de relatos" ON public.reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para admin autenticado em relatos" ON public.reports;
CREATE POLICY "Permitir tudo para admin autenticado em relatos" ON public.reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Configurações (settings)
DROP POLICY IF EXISTS "Permitir leitura pública de configurações" ON public.settings;
CREATE POLICY "Permitir leitura pública de configurações" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir tudo para admin autenticado em configurações" ON public.settings;
CREATE POLICY "Permitir tudo para admin autenticado em configurações" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Logs de Auditoria (action_logs)
DROP POLICY IF EXISTS "Permitir tudo para admin autenticado em logs" ON public.action_logs;
CREATE POLICY "Permitir tudo para admin autenticado em logs" ON public.action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- 4. CRIAÇÃO DE FUNÇÕES E TRIGGERS
-- --------------------------------------------------------

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
  SELECT value INTO current_alerts FROM public.settings WHERE key = 'network_alerts';
  IF current_alerts IS NULL THEN
    current_alerts := '[]'::jsonb;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(current_alerts) LOOP
    IF (item->>'is_active')::boolean = TRUE AND (item->>'alert_type') = 'Detecção Automática' THEN
      alert_exists := TRUE;
      EXIT;
    END IF;
  END LOOP;
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
    updated_alerts := jsonb_build_array(new_alert) || current_alerts;
    INSERT INTO public.settings (key, value, updated_at)
    VALUES ('network_alerts', updated_alerts, timezone('utc'::text, now()))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
    RETURN updated_alerts;
  END IF;
  IF trigger_active = FALSE AND alert_exists = TRUE THEN
    updated_alerts := '[]'::jsonb;
    FOR item IN SELECT * FROM jsonb_array_elements(current_alerts) LOOP
      IF (item->>'is_active')::boolean = TRUE AND (item->>'alert_type') = 'Detecção Automática' THEN
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

-- --------------------------------------------------------
-- 5. INSERÇÃO DOS DADOS ATUAIS (MIGRAÇÃO DE REGISTROS)
-- --------------------------------------------------------

-- Desabilitar triggers temporariamente para evitar loops/alterações indesejadas no insert
SET session_replication_role = 'replica';

-- Serviços (services)
INSERT INTO public.services (id, name, category, status, icon_name, ping_enabled, ping_address, ping_interval, created_at) VALUES
('266881e7-586d-4514-984b-3815787e5ddf', 'WhatsApp', 'Redes Sociais', 'normal', 'MessageSquare', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('41fedd14-a310-42eb-8df3-9149bf78f7bb', 'Twitter / X', 'Redes Sociais', 'normal', 'Twitter', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('bb1f8817-a373-4ec1-82c3-1c2ae3c8bde2', 'TikTok', 'Redes Sociais', 'normal', 'Video', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('302e6cb4-a87b-4e89-916c-4ec3d93179ef', 'Prime Video', 'Streaming', 'normal', 'Tv', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('7e169aa6-a789-49b9-89a0-d75fcf21924a', 'YouTube', 'Streaming', 'normal', 'Youtube', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('6b9fe8b7-56f0-4a86-bd66-dba4fd04b02c', 'Twitch', 'Streaming', 'normal', 'Twitch', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('0d4b61c5-df84-4cb4-ab18-7928b5b1ba71', 'Starlink', 'Telecomunicação', 'normal', 'Globe', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('bb9bc71e-cd46-47ed-a323-02bb60bb3057', 'Vivo', 'Telecomunicação', 'normal', 'Globe', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('6f1a1d3d-9a22-42b0-8f02-aa4f78bfbe78', 'Oi Fibra', 'Telecomunicação', 'normal', 'Globe', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('bb69f220-6852-4495-ba0e-79f7abb01d12', 'Claro', 'Telecomunicação', 'normal', 'Globe', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('dda1d92c-a50d-4772-a830-5b35947673ef', 'Google Chat', 'Redes Sociais', 'normal', 'MessageSquare', FALSE, '', 30, '2026-06-01T02:27:56.506256+00:00'),
('41d6c97e-d348-4458-a574-5fe3f0563add', 'BTV', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:40:44.656054+00:00'),
('262db057-595b-4c95-b04b-0206087cac35', 'Red Play', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:47:52.759716+00:00'),
('3387f7e2-a649-459c-b123-a46b203972d2', 'Cine Duo', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:48:11.64901+00:00'),
('1ffef182-24d9-44d1-ba63-fd1950b4d50f', 'My Family Cinema', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:48:38.321528+00:00'),
('99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'Blue TV', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:48:50.946917+00:00'),
('2ddaffe0-a3bb-4972-8532-3d7b6429956b', 'Eppi Cinema', 'IPTV', 'normal', 'Tv', FALSE, '', 30, '2026-06-01T02:49:02.710655+00:00'),
('845bbab1-dbd3-4a7e-9401-5dbfbe7e95d5', 'League of Legends', 'Jogos Online', 'normal', 'Gamepad2', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('184c1899-8618-4ef7-899e-7289fe04ceb2', 'Valorant', 'Jogos Online', 'normal', 'Gamepad2', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('048b6109-5520-4da2-bb55-8679239a65bf', 'GTA V Online', 'Jogos Online', 'normal', 'Gamepad2', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('93ba9f85-b21d-42bf-af2f-2f10d202bc7e', 'Roblox', 'Jogos Online', 'normal', 'Gamepad2', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('30067153-3d86-4ebb-b442-6ec3fb261a50', 'Free Fire', 'Jogos Online', 'normal', 'Gamepad2', FALSE, '', 30, '2026-05-30T02:18:05.806564+00:00'),
('9c2282a2-8a0f-43f3-8c3d-a1a6dc020d39', 'Gov.br', 'Serviços Públicos', 'normal', 'Landmark', FALSE, '', 30, '2026-06-01T03:05:51.331299+00:00'),
('b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'Facebook', 'Redes Sociais', 'normal', 'MessageSquare', TRUE, 'www.facebook.com/favicon.ico', 30, '2026-05-30T02:18:05.806564+00:00'),
('2f7a11fe-ac0d-4050-98ab-51314dfedaea', 'Google', 'Tecnologia', 'normal', 'Globe', TRUE, 'www.google.com/favicon.ico', 30, '2026-06-03T05:59:37.340199+00:00'),
('aba2c9b3-2502-41b3-9323-01f6d505164e', 'Netflix', 'Streaming', 'normal', 'Tv', TRUE, 'www.netflix.com/favicon.ico', 30, '2026-05-30T02:18:05.806564+00:00'),
('4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'Instagram', 'Redes Sociais', 'normal', 'MessageSquare', TRUE, 'www.instagram.com/favicon.ico', 30, '2026-05-30T02:18:05.806564+00:00'),
('e678430b-c88d-4ed0-8926-a7c10c874444', 'Amazon', 'Tecnologia', 'normal', 'Globe', TRUE, 'www.amazon.com.br/favicon.ico', 30, '2026-06-03T21:36:43.219427+00:00'),
('b8257703-defb-45aa-b346-a804d64a567b', 'Disney+', 'Streaming', 'normal', 'Tv', TRUE, 'www.disneyplus.com.br/favicon', 30, '2026-05-30T02:18:05.806564+00:00'),
('71c5c9da-4d6c-40fc-9add-5c740fff13a0', 'PIX', 'Serviços Públicos', 'normal', 'Landmark', TRUE, 'https://olinda.bcb.gov.br/olinda/servico/Pix_DadosAbertos/versao/v1/odata/', 30, '2026-06-03T22:31:43.309312+00:00'),
('dfb98204-88b0-4117-8e62-4abaae5025a0', 'Rocket League', 'Jogos Online', 'normal', 'Gamepad2', TRUE, 'www.services.rocketleague.com', 30, '2026-06-03T22:34:23.572051+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  icon_name = EXCLUDED.icon_name,
  ping_enabled = EXCLUDED.ping_enabled,
  ping_address = EXCLUDED.ping_address,
  ping_interval = EXCLUDED.ping_interval,
  created_at = EXCLUDED.created_at;

-- Configurações (settings)
INSERT INTO public.settings (key, value, updated_at) VALUES
('report_options', '{"devices":["Celular (Smartphone)","PC / Notebook","Smart TV","TV Box","Videogame (Console)","Fire Stick, Chromecast (ou similares)"],"regions":["OLT1 CANMV","OLT2_CANMV","OLT3_CANRB","OLT4_CANNT","OLT5_CANEV","OLT6_CANIG","OLT7_CANIG","OLT1_EIOCE","OLT2_EIOLB","OLT3_EIOEP","OLT_01_NHOCE","OLT_02_NHOCE","OLT_03_NHOPN","OLT_04_NHOPN","OLT_05_NHOCD","OLT_06_NHOCD","OLT_07_NHOLG","OLT_01_SLESC","OLT_02_SLECP","OLT_03_SLEFT","OLT_04_SLECE","OLT_05_SLECE","OLT1_SPSCE_ZTE_C600","OLT2_SPSPI","OLT_01_TNFLT","OLT_01_CHNVA","OLT_02_CHNVA","OLT_03_CHNVC (EM ATIVAÇÃO)"],"issue_types":["Lentidão de navegação","Perda de pacotes (Packet Loss)","Latência alta (Ping alto)","Queda total da internet","IPTV travando / Sem sinal"],"connection_types":["Cabo (Ethernet)","Wi-Fi (2.4GHz/5GHz)","Repetidor de sinal Wi-Fi"]}'::jsonb, '2026-05-30T03:04:36.718+00:00'),
('status_thresholds', '{"warning":3,"critical":6,"labelNormal":"Normal","labelWarning":"Instabilidade","labelCritical":"Queda total","windowMinutes":30,"chartWindowHours":24}'::jsonb, '2026-06-01T16:50:12.3+00:00'),
('admin_users', '[{"name":"Matheus","role":"superadmin","email":"admin@intradetector.com","permissions":{"form":true,"logs":true,"cards":true,"rules":true,"alerts":true}},{"name":"COR","role":"superadmin","email":"cor@intradetector.com.br","permissions":{"form":true,"logs":true,"cards":true,"rules":true,"alerts":true}},{"role":"admin","email":"matheus.santos@intradetector.com.br","permissions":{"form":"write","logs":"write","cards":"write","rules":"write","alerts":"write"}}]'::jsonb, '2026-06-03T00:45:45.884+00:00'),
('form_schema', '[{"id":"region","type":"select","label":"Ponto de Acesso","options":["OLT1 CANMV","OLT2_CANMV","OLT3_CANRB","OLT4_CANNT","OLT5_CANEV","OLT6_CANIG","OLT7_CANIG","OLT1_EIOCE","OLT2_EIOLB","OLT3_EIOEP","OLT_01_NHOCE","OLT_02_NHOCE","OLT_03_NHOPN","OLT_04_NHOPN","OLT_05_NHOCD","OLT_06_NHOCD","OLT_07_NHOLG","OLT_01_SLESC","OLT_02_SLECP","OLT_03_SLEFT","OLT_04_SLECE","OLT_05_SLECE","OLT1_SPSCE_ZTE_C600","OLT2_SPSPI","OLT_01_TNFLT","OLT_01_CHNVA","OLT_02_CHNVA","OLT_03_CHNVC (EM ATIVAÇÃO)"],"required":true},{"id":"connection_type","type":"select","label":"Transmissão","options":["Cabo (Ethernet)","Wi-Fi (2.4G/5G)"],"required":true},{"id":"issue_type","type":"select","label":"Problema Relatado","options":["Lentidão de navegação","Streaming travando","Vídeos não carregam","Perda de pacotes","Latência alta (Ping alto)","Queda total da internet","IPTV travando / Sem sinal"],"required":true},{"id":"field_1780245461137","type":"select","label":"Período que iniciou","options":["Dentro de 1h atrás","Dentro de 2h atrás","Dentro de 3h atrás","Mais de 4h atrás","Mais de 24h atrás"],"required":true},{"id":"device","type":"select","label":"Dispositivo","options":["Celular (Smartphone)","PC / Notebook","Smart TV","TV Box","Videogame (Console)","Fire Stick","Chromecast","Câmera Wi-Fi","Câmera IP","Outros"],"required":true},{"id":"field_1780192919696","type":"select","label":"Testes Realizados","options":["Reboot","Ajuste padrão e reboot","Pool do Suporte","Alteração de DNS","Outros"],"required":true},{"id":"field_1780206637012","type":"text","label":"PPPoE do cliente","options":["Opção 1","Opção 2"],"required":false}]'::jsonb, '2026-06-03T01:03:38.155+00:00'),
('network_alert_config', '{"autoTitle":"Alerta Automático","autoEnabled":true,"autoMinReports":2,"autoPercentage":50,"autoDescription":"Alto volume de relatos detectado. Necessário acionar o COR ou CGR para verificar possíveis anomalias na rede.","displayInterval":10,"autoCloseInterval":60,"lastManualAlertInactiveAt":"2026-06-03T03:50:28.926Z"}'::jsonb, '2026-06-03T03:50:28.926+00:00'),
('form_config', '{"showRelatedServices":true}'::jsonb, '2026-06-03T01:03:39.654+00:00'),
('service_categories', '[{"id":"redes-sociais","name":"Redes Sociais","icon_name":"MessageSquare"},{"id":"streaming","name":"Streaming","icon_name":"Tv"},{"id":"jogos","name":"Jogos Online","icon_name":"Gamepad2"},{"id":"iptv-provedores","name":"Telecomunicação","icon_name":"Globe"},{"id":"cc1ed288-b391-40d7-87f7-1cfc707fc126","name":"IPTV","icon_name":"Tv"},{"id":"f058e5d4-030c-42d8-ae89-a6548a3e3d6f","name":"Serviços Públicos","icon_name":"Landmark"},{"id":"d07d1e3d-b920-4ef1-ac0f-1e01e4977c85","name":"Tecnologia","icon_name":"Globe"}]'::jsonb, '2026-06-03T05:59:01.744+00:00'),
('network_alerts', '[{"id":"80c02fc2-6fba-4d14-a1f5-701ca2b36631","title":"Alerta Automático","is_auto":true,"is_active":false,"alert_type":"Detecção Automática","created_at":"2026-06-03T02:29:03.831265","expires_at":null,"updated_at":"2026-06-03T02:37:15.402221","description":"Alto volume de relatos detectado. Necessário acionar o COR ou CGR para verificar possíveis anomalias na rede."},{"id":"9acb96e4-866f-43e0-b30e-e8673535aac9","title":"Alerta Automático","is_auto":true,"is_active":false,"alert_type":"Detecção Automática","created_at":"2026-06-01T17:13:41.039976","expires_at":null,"updated_at":"2026-06-01T18:16:00.200938","description":"Alto volume de relatos detectado. Necessário acionar o COR ou CGR para verificar possíveis anomalias na rede."},{"id":"feb68f97-f0ed-4e86-acda-4d71d26c71a4","title":"Lentidão em Canoas (teste)","is_active":false,"alert_type":"Lentidão / Latência","created_at":"2026-05-31T20:12:19.145Z","expires_at":null,"updated_at":"2026-06-03T03:50:27.252Z","description":"Anormalidade de rede identificada na região de Canoas"},{"id":"a3046a3d-d6d2-45a8-a4dc-b65e6d5aff42","title":"Ataque DDoS (teste)","is_active":false,"alert_type":"Instabilidade Geral","created_at":"2026-05-31T20:05:47.207Z","expires_at":null,"updated_at":"2026-06-01T00:09:21.784Z","description":"Degradação na rede decorrente de ataque DDoS."}]'::jsonb, '2026-06-03T03:50:27.252+00:00'),
('ping_config', '{"mode":"threshold","label":"Conexão TCP/HTTP do serviço","threshold_green":120,"threshold_yellow":250}'::jsonb, '2026-06-10T01:24:20.04+00:00')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;

-- Relatos (reports)
INSERT INTO public.reports (id, service_id, region, connection_type, issue_type, device, tests_done, is_resolved, created_at, custom_fields) VALUES
('d5b70eec-aec9-4097-95b7-bcbe1d03c7a2', '302e6cb4-a87b-4e89-916c-4ec3d93179ef', 'Rio de Janeiro (RJ)', 'Wi-Fi (2.4GHz)', 'Perda de pacotes (Packet Loss)', 'PC / Notebook', 'Nenhum teste informado', TRUE, '2026-05-30T02:21:59.613116+00:00', '{}'::jsonb),
('29fecc11-468e-429a-875c-298d4d11230c', 'bb69f220-6852-4495-ba0e-79f7abb01d12', 'OLT_02_CHNVA', 'Wi-Fi (2.4GHz/5GHz)', 'Lentidão de navegação', 'Celular (Smartphone)', 'Reboot do roteador', FALSE, '2026-05-30T03:06:33.634381+00:00', '{}'::jsonb),
('3d7afb30-6bff-4ce4-905c-82b4890e2cd2', 'b8257703-defb-45aa-b346-a804d64a567b', 'OLT6_CANIG', 'Cabo (Ethernet)', 'Lentidão de navegação', 'Smart TV', 'Nenhum teste informado', FALSE, '2026-05-30T03:42:25.698232+00:00', '{}'::jsonb),
('1ce189ed-a6a7-4315-9b2e-9ff62e628c40', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT5_CANEV', 'Wi-Fi (2.4GHz/5GHz)', 'Latência alta (Ping alto)', 'Celular (Smartphone)', 'Nenhum teste informado', FALSE, '2026-05-30T04:14:58.081174+00:00', '{}'::jsonb),
('26ca6ba7-5e97-45a1-a729-1bb80f73e218', 'aba2c9b3-2502-41b3-9323-01f6d505164e', 'OLT3_CANRB', 'Wi-Fi (2.4GHz/5GHz)', 'Lentidão de navegação', 'PC / Notebook', 'Nenhum teste informado', FALSE, '2026-05-30T04:26:08.134746+00:00', '{}'::jsonb),
('32f04c4b-9b0f-450d-9b11-ceac0b52f4c9', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT2_CANMV', 'Wi-Fi (2.4GHz/5GHz)', 'Perda de pacotes (Packet Loss)', 'Celular (Smartphone)', 'Nenhum teste informado', FALSE, '2026-05-30T04:35:27.672073+00:00', '{}'::jsonb),
('ae919780-4f91-435e-80d5-eff323837d86', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT6_CANIG', 'Cabo (Ethernet)', 'Latência alta (Ping alto)', 'Smart TV', 'Nenhum teste informado', FALSE, '2026-05-30T04:37:38.794483+00:00', '{}'::jsonb),
('b89ebdc3-4e67-4a8f-b7d0-35b0a6ccb448', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT1 CANMV', 'Wi-Fi (2.4GHz)', 'Latência alta (Ping alto)', 'Celular (Smartphone)', NULL, FALSE, '2026-05-31T03:12:46.354318+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Latência alta (Ping alto)","connection_type":"Wi-Fi (2.4GHz)","field_1780192919696":"Reboot"}'::jsonb),
('e38b19bf-ff91-4bcb-a26f-32449576dfca', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT5_CANEV', 'Wi-Fi (2.4GHz/5GHz)', 'Perda de pacotes (Packet Loss)', 'Celular (Smartphone)', NULL, TRUE, '2026-05-31T07:50:30.225513+00:00', '{"device":"Celular (Smartphone)","region":"OLT5_CANEV","issue_type":"Perda de pacotes (Packet Loss)","connection_type":"Wi-Fi (2.4GHz/5GHz)","field_1780192919696":"Reboot"}'::jsonb),
('2a3a4496-f15c-4559-bf29-36dc89362ef5', 'b8257703-defb-45aa-b346-a804d64a567b', 'OLT1 CANMV', 'Cabo (Ethernet)', 'Lentidão de navegação', 'Smart TV', NULL, FALSE, '2026-05-31T16:26:02.726625+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Cabo (Ethernet)","field_1780192919696":"Reboot","field_1780206637012":""}'::jsonb),
('4fc6e0c4-f833-4ee0-bee3-afca4da7a1ad', 'b8257703-defb-45aa-b346-a804d64a567b', 'OLT1 CANMV', 'Cabo (Ethernet)', 'Streaming travando', 'TV Box', NULL, FALSE, '2026-05-31T20:33:09.454638+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Streaming travando","active_alert":"Ataque DDoS (teste)","connection_type":"Cabo (Ethernet)","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('2051a9b9-66fd-4c80-a584-ca2a726221a0', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T00:14:11.586172+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('0017499d-3feb-4e19-a403-bda8f3d5b16c', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, TRUE, '2026-06-01T00:14:43.596815+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('78c9fff5-2b85-4984-b5bd-caf31d319854', '266881e7-586d-4514-984b-3815787e5ddf', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T00:19:42.572729+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('8fa22dc4-6ce1-4c3e-998d-7dcb50eff49e', '93ba9f85-b21d-42bf-af2f-2f10d202bc7e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Latência alta (Ping alto)', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T00:34:03.197634+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Latência alta (Ping alto)","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('d5d86fbc-0855-4924-b8b7-10c86174e7d8', '266881e7-586d-4514-984b-3815787e5ddf', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, TRUE, '2026-06-01T00:37:01.279729+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('9e3f3a51-7992-4b3e-8d00-a720e0ae1a29', '266881e7-586d-4514-984b-3815787e5ddf', 'OLT2_CANMV', 'Wi-Fi (2.4G/5G)', 'Perda de pacotes', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T00:38:13.302094+00:00', '{"device":"Celular (Smartphone)","region":"OLT2_CANMV","issue_type":"Perda de pacotes","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('a2cd79c0-22ef-4028-9dd0-d5742de00b43', 'aba2c9b3-2502-41b3-9323-01f6d505164e', 'OLT2_CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, TRUE, '2026-06-01T00:51:49.776795+00:00', '{"device":"Smart TV","region":"OLT2_CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('9beb7183-1f0b-43f3-a310-d582d1bf777e', '302e6cb4-a87b-4e89-916c-4ec3d93179ef', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'TV Box', NULL, FALSE, '2026-06-01T00:52:24.179389+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('8b7a438e-e3b3-4165-85bc-8063303e1184', 'b8257703-defb-45aa-b346-a804d64a567b', 'OLT1 CANMV', 'Cabo (Ethernet)', 'Vídeos não carregam', 'Smart TV', NULL, TRUE, '2026-06-01T00:56:08.282957+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","active_alert":"Alerta Automático","connection_type":"Cabo (Ethernet)","field_1780192919696":"Pool do Suporte","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('3be86ffc-61d2-4104-a2b5-a54013d346f0', '266881e7-586d-4514-984b-3815787e5ddf', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T01:25:41.208359+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"97d0d617-a73b-4ac1-ba1f-e568eeec3e4a","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('a8f2a16c-d6f1-4e50-8e3c-991c9b3201e5', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T01:25:41.208359+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"97d0d617-a73b-4ac1-ba1f-e568eeec3e4a","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('31cd61e5-a382-4c79-a906-f18fd8405abe', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T01:25:41.208359+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"97d0d617-a73b-4ac1-ba1f-e568eeec3e4a","field_1780192919696":"Reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('4f5335ee-1c68-4ac8-a4f2-49d6782491bb', '41d6c97e-d348-4458-a574-5fe3f0563add', 'OLT1 CANMV', 'Cabo (Ethernet)', 'Vídeos não carregam', 'TV Box', NULL, FALSE, '2026-06-01T03:18:18.711663+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Cabo (Ethernet)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('9219985c-c148-435a-a044-15780a9d9d51', '1ffef182-24d9-44d1-ba63-fd1950b4d50f', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'TV Box', NULL, FALSE, '2026-06-01T03:19:16.555191+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('0dd6dc96-9b13-4e37-bdc8-4951a96f4be0', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'TV Box', NULL, FALSE, '2026-06-01T03:19:16.555191+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('81bd9c78-8155-4d01-b3ed-5a5524aa24a1', '41d6c97e-d348-4458-a574-5fe3f0563add', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'TV Box', NULL, FALSE, '2026-06-01T03:19:16.555191+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('7a9f4aca-d5c8-406e-8912-8e561a2301d8', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT2_CANMV', 'Cabo (Ethernet)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-01T03:19:53.407434+00:00', '{"device":"Smart TV","region":"OLT2_CANMV","issue_type":"Streaming travando","connection_type":"Cabo (Ethernet)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('e9362989-e684-420f-9131-e2a5c6dfc0ce', '3387f7e2-a649-459c-b123-a46b203972d2', 'OLT2_CANMV', 'Cabo (Ethernet)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-01T03:19:53.407434+00:00', '{"device":"Smart TV","region":"OLT2_CANMV","issue_type":"Streaming travando","connection_type":"Cabo (Ethernet)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('12a51b15-769b-46ea-875a-48a0e3cf7d81', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Smart TV', NULL, FALSE, '2026-06-01T03:20:19.565683+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"697c562c-d662-4671-a0f1-02aeeea100bb","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('28737418-5e6c-432a-828d-cc522c472353', '3387f7e2-a649-459c-b123-a46b203972d2', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-01T03:21:39.540764+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"a60439b0-7c1b-4fd0-b2a2-3a59cf685236","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('8c25e77a-0482-42c3-8b64-f7f216b4afda', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-01T03:21:39.540764+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"a60439b0-7c1b-4fd0-b2a2-3a59cf685236","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('c4ebf4a3-46af-456f-b647-f80685d07df9', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Latência alta (Ping alto)', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:04:37.925707+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Latência alta (Ping alto)","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('520e5abd-037b-4f3d-a921-77c29a69398c', '845bbab1-dbd3-4a7e-9401-5dbfbe7e95d5', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Latência alta (Ping alto)', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:04:37.925707+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Latência alta (Ping alto)","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('803438e3-2191-48e5-b3ca-a03ea0a35835', '93ba9f85-b21d-42bf-af2f-2f10d202bc7e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Perda de pacotes', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:05:25.833716+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Perda de pacotes","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"c7d150d1-9618-4a28-83f1-ea766d1f71d6","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('0b46f15a-6f2f-48f7-8aab-c76b1388de0f', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Perda de pacotes', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:05:25.833716+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Perda de pacotes","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"c7d150d1-9618-4a28-83f1-ea766d1f71d6","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('c8bc7263-f040-43ae-b347-2566aa8a687d', '2ddaffe0-a3bb-4972-8532-3d7b6429956b', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:13:07.711007+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('cc7e518e-1aa9-4d8e-aeb9-f1c3abdd5b6b', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:13:07.711007+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 2h atrás"}'::jsonb),
('c52bed52-a8e5-4da5-bb03-88960c24a397', '3387f7e2-a649-459c-b123-a46b203972d2', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:13:40.291154+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"55a5fe2f-7537-4a8e-8689-2068a485b496","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('2dfeb4cb-91d7-41b9-863d-5479df90f083', '41d6c97e-d348-4458-a574-5fe3f0563add', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Celular (Smartphone)', NULL, FALSE, '2026-06-01T17:13:40.291154+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"55a5fe2f-7537-4a8e-8689-2068a485b496","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('a2bea44f-526b-47d1-8e8f-5135febe24db', '266881e7-586d-4514-984b-3815787e5ddf', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Celular (Smartphone)', NULL, TRUE, '2026-06-02T03:14:34.77863+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('daaa06d3-666c-47ec-92d6-a265524b4b5a', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Celular (Smartphone)', NULL, TRUE, '2026-06-02T03:14:34.77863+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('116278e3-15cd-40ca-8c80-afd5558982ce', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Celular (Smartphone)', NULL, TRUE, '2026-06-02T03:14:34.77863+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('d8f4cba0-971d-4ee3-82a6-c83a53e5a9a8', '41d6c97e-d348-4458-a574-5fe3f0563add', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'TV Box', NULL, FALSE, '2026-06-02T03:18:37.331082+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('a828b4e4-3e1c-4e30-b7d1-0a81bd5efb84', 'b8257703-defb-45aa-b346-a804d64a567b', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'TV Box', NULL, FALSE, '2026-06-02T03:18:37.331082+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('4abdce03-fd8a-4a8e-935e-80e177ee22c6', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'TV Box', NULL, FALSE, '2026-06-02T03:18:37.331082+00:00', '{"device":"TV Box","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('6118218b-11ee-4135-8f49-6603144733a1', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-02T03:24:37.478829+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('9804da87-ccaa-4ba8-bf5f-016cf3fd14fd', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Vídeos não carregam', 'Celular (Smartphone)', NULL, FALSE, '2026-06-02T03:24:37.478829+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Vídeos não carregam","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('737f94da-9bd9-42ac-909f-4bf039abb821', '30067153-3d86-4ebb-b442-6ec3fb261a50', 'OLT2_CANMV', 'Wi-Fi (2.4G/5G)', 'Perda de pacotes', 'Celular (Smartphone)', NULL, TRUE, '2026-06-02T03:26:35.617473+00:00', '{"device":"Celular (Smartphone)","region":"OLT2_CANMV","issue_type":"Perda de pacotes","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('12f8ea61-0fd0-4e35-b264-9d5b195db20c', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT2_CANMV', 'Wi-Fi (2.4G/5G)', 'Perda de pacotes', 'Celular (Smartphone)', NULL, TRUE, '2026-06-02T03:26:35.617473+00:00', '{"device":"Celular (Smartphone)","region":"OLT2_CANMV","issue_type":"Perda de pacotes","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"d6115583-3a14-403f-a291-fe018951ab7d","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('67d43483-ecee-4fde-825b-51a2408d5ee7', 'dda1d92c-a50d-4772-a830-5b35947673ef', 'OLT_04_NHOPN', 'Cabo (Ethernet)', 'Perda de pacotes', 'Smart TV', NULL, FALSE, '2026-06-03T01:27:27.573857+00:00', '{"device":"Smart TV","region":"OLT_04_NHOPN","issue_type":"Perda de pacotes","connection_type":"Cabo (Ethernet)","visitor_session_id":"db3e686d-d78a-4f81-912e-44b5ee47d5a1","field_1780192919696":"Reboot","field_1780206637012":"suzianesilva235588","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('02a613e6-e630-4970-bb01-2d53193aef71', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT2_CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Celular (Smartphone)', NULL, FALSE, '2026-06-03T01:28:00.68071+00:00', '{"device":"Celular (Smartphone)","region":"OLT2_CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"db3e686d-d78a-4f81-912e-44b5ee47d5a1","field_1780192919696":"Reboot","field_1780206637012":"marinamachado261145","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('296fd859-3348-4243-81ed-b5dd92d3be1d', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-03T02:25:34.125529+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('40f48c6f-027c-4e40-8083-188dbf2c714b', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-03T02:26:09.970414+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('622463cd-4d1c-44e7-835d-c9ccd7afb688', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-03T02:26:48.01257+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('8a074d9a-a614-4d8b-9fa3-b2e49d4685f3', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Streaming travando', 'Smart TV', NULL, FALSE, '2026-06-03T02:27:20.497875+00:00', '{"device":"Smart TV","region":"OLT1 CANMV","issue_type":"Streaming travando","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('426e1229-44e8-4bc5-8f35-12ee9e70fca3', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT4_CANNT', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T02:29:03.138588+00:00', '{"device":"PC / Notebook","region":"OLT4_CANNT","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"101b3950-941a-4eb7-81c5-c15d93d9b1a0","field_1780192919696":"Reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('b3d58391-215a-4735-8e2d-116990aead25', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT4_CANNT', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T02:30:21.24186+00:00', '{"device":"PC / Notebook","region":"OLT4_CANNT","issue_type":"Lentidão de navegação","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('7bda0c06-c145-40fc-a98a-b2a216117283', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT4_CANNT', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T02:31:11.102338+00:00', '{"device":"PC / Notebook","region":"OLT4_CANNT","issue_type":"Lentidão de navegação","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('7f4948f5-1441-4a33-b7ec-24af89835b4c', 'b0871ab5-3fc8-4c6c-8d1b-20098c470e4e', 'OLT4_CANNT', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T02:31:45.28267+00:00', '{"device":"PC / Notebook","region":"OLT4_CANNT","issue_type":"Lentidão de navegação","active_alert":"Alerta Automático","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"31239296-bb8d-4b43-9ae5-7d67571ba624","field_1780192919696":"Reboot","field_1780206637012":"sandrosantos_6","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('5daa2b0d-6459-4cc3-a4e5-68a28895d765', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT_06_NHOCD', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T03:13:46.093698+00:00', '{"device":"PC / Notebook","region":"OLT_06_NHOCD","issue_type":"Lentidão de navegação","active_alert":"Lentidão em Canoas (teste)","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"77a5c138-db36-44e4-a223-2ebc24da26e5","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"danielamachado226689","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('d71b1a13-e2f6-4757-b96b-dc75114a2620', '4c396b2a-a3b9-43d2-bf44-5d61e2ad7c5c', 'OLT_06_NHOCD', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'PC / Notebook', NULL, FALSE, '2026-06-03T03:14:28.904169+00:00', '{"device":"PC / Notebook","region":"OLT_06_NHOCD","issue_type":"Lentidão de navegação","active_alert":"Lentidão em Canoas (teste)","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"77a5c138-db36-44e4-a223-2ebc24da26e5","field_1780192919696":"Ajuste padrão e reboot","field_1780206637012":"danielamachado226689","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('c3842a76-f760-4e57-9729-1eafd04c3729', 'e678430b-c88d-4ed0-8926-a7c10c874444', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Celular (Smartphone)', NULL, TRUE, '2026-06-07T23:13:46.321241+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"63c2a1e3-ece8-4797-a8c1-750af9894323","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb),
('628fd64e-9dd7-42e9-b590-06be2c8290c4', '99d2f047-6317-4709-9ac9-9ed8c9d1e210', 'OLT1 CANMV', 'Wi-Fi (2.4G/5G)', 'Lentidão de navegação', 'Celular (Smartphone)', NULL, TRUE, '2026-06-07T23:13:46.792881+00:00', '{"device":"Celular (Smartphone)","region":"OLT1 CANMV","issue_type":"Lentidão de navegação","connection_type":"Wi-Fi (2.4G/5G)","visitor_session_id":"63c2a1e3-ece8-4797-a8c1-750af9894323","field_1780192919696":"Ajuste padrão e reboot","field_1780245461137":"Dentro de 1h atrás"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id,
  region = EXCLUDED.region,
  connection_type = EXCLUDED.connection_type,
  issue_type = EXCLUDED.issue_type,
  device = EXCLUDED.device,
  tests_done = EXCLUDED.tests_done,
  is_resolved = EXCLUDED.is_resolved,
  created_at = EXCLUDED.created_at,
  custom_fields = EXCLUDED.custom_fields;

-- Restaurar triggers para o comportamento padrão
SET session_replication_role = 'origin';

-- --------------------------------------------------------
-- 6. HABILITAR CANAL REALTIME
-- --------------------------------------------------------

-- Adicionar as tabelas na publicação do realtime. Ignorar avisos se já existirem na publicação.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.action_logs;
EXCEPTION WHEN OTHERS THEN
  -- Ignora erros se a publicação já contiver as tabelas ou se não existir
  NULL;
END $$;
