-- 1. Criar tabela de serviços (services)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    icon_name TEXT, -- Nome do ícone do Lucide (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Criar tabela de relatos (reports)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    connection_type TEXT NOT NULL, -- Ex: Cabo, Wi-Fi, PPPoE
    issue_type TEXT NOT NULL, -- Ex: Lentidão, Perda de pacote, Queda total
    device TEXT NOT NULL, -- Ex: Celular, PC, Smart TV, Tablet
    tests_done TEXT, -- Ex: Reboot
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Criar tabela de configurações (settings) para o formulário
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para a tabela de 'services'
-- Permitir leitura pública (anon e authenticated)
CREATE POLICY "Permitir leitura pública de serviços" 
ON public.services FOR SELECT 
USING (true);

-- Permitir qualquer operação para administradores autenticados
CREATE POLICY "Permitir tudo para admin autenticado em serviços" 
ON public.services FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Políticas para a tabela de 'reports'
-- Permitir leitura pública de relatos
CREATE POLICY "Permitir leitura pública de relatos" 
ON public.reports FOR SELECT 
USING (true);

-- Permitir inserção pública de relatos (anon e authenticated)
CREATE POLICY "Permitir inserção pública de relatos" 
ON public.reports FOR INSERT 
WITH CHECK (true);

-- Permitir atualizações/deleções apenas para admin autenticado
CREATE POLICY "Permitir tudo para admin autenticado em relatos" 
ON public.reports FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Políticas para a tabela de 'settings'
-- Permitir leitura pública de configurações
CREATE POLICY "Permitir leitura pública de configurações" 
ON public.settings FOR SELECT 
USING (true);

-- Permitir tudo para admin autenticado em configurações
CREATE POLICY "Permitir tudo para admin autenticado em configurações" 
ON public.settings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 7. Inserir dados iniciais (Seed) de serviços
INSERT INTO public.services (name, category, status, icon_name) VALUES
-- Redes Sociais
('WhatsApp', 'Redes Sociais', 'normal', 'MessageSquare'),
('Instagram', 'Redes Sociais', 'normal', 'Instagram'),
('Facebook', 'Redes Sociais', 'normal', 'Facebook'),
('Twitter / X', 'Redes Sociais', 'normal', 'Twitter'),
('TikTok', 'Redes Sociais', 'normal', 'Video'),
-- Jogos
('League of Legends', 'Jogos', 'normal', 'Gamepad2'),
('Valorant', 'Jogos', 'normal', 'Gamepad2'),
('GTA V Online', 'Jogos', 'normal', 'Gamepad2'),
('Roblox', 'Jogos', 'normal', 'Gamepad2'),
('Free Fire', 'Jogos', 'normal', 'Gamepad2'),
-- Streaming
('Netflix', 'Streaming', 'normal', 'Tv'),
('Prime Video', 'Streaming', 'normal', 'Tv'),
('YouTube', 'Streaming', 'normal', 'Youtube'),
('Twitch', 'Streaming', 'normal', 'Twitch'),
('Disney+', 'Streaming', 'normal', 'Tv'),
-- IPTV & Provedores
('IPTV Premium', 'IPTV & Provedores', 'normal', 'Globe'),
('Starlink', 'IPTV & Provedores', 'normal', 'Wifi'),
('Claro', 'IPTV & Provedores', 'normal', 'Wifi'),
('Vivo', 'IPTV & Provedores', 'normal', 'Wifi'),
('Oi Fibra', 'IPTV & Provedores', 'normal', 'Wifi')
ON CONFLICT (name) DO NOTHING;

-- 8. Inserir dados iniciais (Seed) das opções do formulário
INSERT INTO public.settings (key, value) VALUES
('report_options', '{
    "regions": ["São Paulo (SP)", "Rio de Janeiro (RJ)", "Minas Gerais (MG)", "Distrito Federal (DF)", "Paraná (PR)", "Rio Grande do Sul (RS)", "Bahia (BA)", "Ceará (CE)", "Pernambuco (PE)", "Santa Catarina (SC)"],
    "connection_types": ["Cabo (Ethernet)", "Wi-Fi (5GHz/6GHz)", "Wi-Fi (2.4GHz)", "Dados Móveis (4G/5G)", "PPPoE Fibra", "Satélite"],
    "issue_types": ["Lentidão de navegação", "Perda de pacotes (Packet Loss)", "Latência alta (Ping alto)", "Queda total da internet", "IPTV travando / Sem sinal"],
    "devices": ["Celular (Smartphone)", "PC / Notebook", "Smart TV / TV Box", "Videogame (Console)", "Roteador"]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 9. Habilitar Realtime para as tabelas
alter publication supabase_realtime add table public.services;
alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.settings;
