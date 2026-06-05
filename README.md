# 📡 Intradetector

O **Intradetector** é um painel moderno e em tempo real para monitoramento de instabilidades, quedas e medição de latência (ping) de serviços e provedores de internet. Inspirado em plataformas como o *Downdetector*, ele permite que usuários relatem problemas em tempo real e fornece aos administradores um dashboard analítico robusto para gerenciar e auditar incidentes, configurar formulários dinâmicos e definir alertas automatizados.

---

## 🚀 Tecnologias Utilizadas

O projeto foi construído utilizando um ecossistema de tecnologias modernas e de alta performance:

*   **Framework Principal:** [Next.js (App Router)](https://nextjs.org/) na versão mais recente, com uso intenso de Client Components para interações assíncronas rápidas.
*   **Biblioteca de UI:** [React 19](https://react.dev/) para reatividade avançada e gerenciamento de estado local.
*   **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) integrado com `@tailwindcss/postcss` para um visual elegante, minimalista, moderno (dark mode nativo) e responsivo.
*   **Componentes de UI:** [Shadcn UI](https://ui.shadcn.com/) customizados para estilização premium e acessibilidade.
*   **Visualização de Dados:** [Recharts](https://recharts.org/) para a renderização de gráficos dinâmicos de linha, área, barra e pizza.
*   **Banco de Dados & Backend:** [Supabase](https://supabase.com/) como Backend-as-a-Service (BaaS):
    *   **PostgreSQL:** Banco de dados relacional.
    *   **Supabase Realtime:** Inscrição em canais PostgreSQL para propagar novos relatos e alterações de configurações para todos os clientes em milissegundos.
    *   **Supabase Presence:** Rastreamento de usuários online para calcular a porcentagem de relatos em relação ao tráfego ativo.
    *   **Row Level Security (RLS):** Proteção rígida a nível de banco de dados, permitindo acesso de leitura/escrita pública de relatos, mas restringindo modificações administrativas apenas a usuários autenticados.
    *   **SQL RPC (Remote Procedure Call):** Funções plpgsql seguras executadas diretamente no banco de dados para lidar com alertas de forma atômica.
*   **Notificações & Toasts:** [Sonner](https://sonner.emilkowal.ski/) para feedbacks visuais e toasts elegantes em tempo real.
*   **Tipagem:** [TypeScript](https://www.typescriptlang.org/) para maior segurança no desenvolvimento e manutenção do código.

---

## 🛠️ Funcionalidades Principais

O Intradetector está dividido em duas frentes principais: a **Página Pública** (visível para os clientes) e o **Painel Administrativo** `/admin` (restrito e protegido por autenticação).

### 👥 1. Área Pública (Dashboard do Usuário)
*   **Painel Geral de Serviços:** Listagem organizada de todos os serviços por categoria (Redes Sociais, Streaming, Jogos, IPTV & Provedores).
*   **Status Dinâmico:** Cada serviço exibe seu estado atual (`Operando`, `Instabilidade` ou `Queda total`), recalculado dinamicamente com base no volume de relatos recebidos nos últimos minutos (definidos nas regras do admin).
*   **Latência em Tempo Real (Ping Real):** Monitora a conexão de serviços com ping habilitado enviando requisições periódicas diretamente do navegador do usuário, exibindo a latência exata (em ms) ou o status Online/Offline através de cores (Verde/Amarelo/Vermelho).
*   **Registro de Relatos Inteligente:** Modal simplificado onde o usuário seleciona detalhes sobre a falha técnica. O formulário é totalmente flexível e adaptável.
*   **Gráfico de Volume de Relatos (24h):** Um gráfico de área (`AreaChart` da Recharts) dinâmico que exibe o histórico de relatos hora a hora nas últimas 24 horas, incluindo indicadores de tempo real ("live") e o pico de relatos.
*   **Alertas de Rede Globais:** Notificações flutuantes automáticas ou manuais que informam sobre instabilidades gerais na rede. Os alertas possuem temporizadores de fechamento automático e frequência de reexibição configuráveis.
*   **Contador de Visitantes:** Rastreamento de sessões simultâneas ativas no site via *Supabase Presence*.

---

### 🛡️ 2. Painel Administrativo (`/admin`)
O painel administrativo do Intradetector oferece ferramentas avançadas de controle, auditoria e personalização:

*   **Controle de Acesso Baseado em Funções (RBAC):**
    *   **Superadmin:** Controle total do sistema.
    *   **Sub-admin:** Permissões personalizáveis a nível de visualização ou edição para áreas específicas (`Cards`, `Formulário`, `Regras`, `Alertas` e `Logs`).
*   **Gestão de Serviços & Categorias (CRUD):**
    *   Criação e edição de serviços, categorização e configuração individual de ping (endereço de ping, intervalo em segundos e se está habilitado).
    *   Criação de categorias com suporte a ícones dinâmicos do *Lucide React*.
*   **Moderação de Relatos:** Listagem detalhada de todos os relatos com filtros por tipo, região, conexão e dispositivo, permitindo a exclusão para limpeza de dados falsos.
*   **Analytics Avançado:**
    *   Gráficos dinâmicos de barras, linhas, áreas e pizza para analisar a distribuição de relatos por região, meio de transmissão, dispositivo e tipo de problema.
    *   Filtros avançados por intervalo de tempo (últimas 24h, 7 dias, customizado) e por serviços específicos.
*   **Construtor de Formulário Dinâmico (Form Builder):**
    *   Permite adicionar, remover ou reordenar campos do formulário de relato (tipos: Seleção/Dropdown ou Texto Livre) diretamente pela interface.
    *   A estrutura é salva como um esquema JSONB na tabela de configurações (`settings`), atualizando o formulário público instantaneamente sem necessidade de novos builds ou deploys de código.
*   **Regras de Cálculo de Status:**
    *   Administradores definem os gatilhos exatos (limiares numéricos de relatos) para que um serviço mude automaticamente de status para `Instabilidade` ou `Queda total`.
    *   Janela de tempo configurável (ex: analisar os relatos dos últimos 30 minutos).
*   **Detecção Automática de Instabilidade:**
    *   Algoritmo inteligente que monitora o volume de relatos em relação ao número de usuários online ativos no site. Se o percentual ultrapassar o configurado, o sistema emite e registra automaticamente um alerta global de instabilidade na rede.
*   **Logs de Auditoria (Audit Trail):**
    *   Registro detalhado de todas as ações administrativas executadas (ex: excluir relato, salvar configuração, editar serviço, login/logout), identificando o usuário responsável, horário e detalhes da alteração.

---

## 🗄️ Modelagem do Banco de Dados (Supabase / Postgres)

O banco de dados PostgreSQL do Supabase é estruturado da seguinte forma:

### 1. Tabela `services`
Registra os serviços monitorados.
*   `id` (UUID, Primary Key)
*   `name` (TEXT, Único)
*   `category` (TEXT)
*   `status` (TEXT: 'normal', 'warning', 'critical')
*   `icon_name` (TEXT)
*   `ping_enabled` (BOOLEAN)
*   `ping_address` (TEXT)
*   `ping_interval` (INTEGER)
*   `created_at` (TIMESTAMP)

### 2. Tabela `reports`
Registra as reclamações enviadas pelos usuários.
*   `id` (UUID, Primary Key)
*   `service_id` (UUID, FK para `services`)
*   `region` (TEXT, opcional - dinâmico)
*   `connection_type` (TEXT, opcional - dinâmico)
*   `issue_type` (TEXT, opcional - dinâmico)
*   `device` (TEXT, opcional - dinâmico)
*   `tests_done` (TEXT)
*   `is_resolved` (BOOLEAN)
*   `custom_fields` (JSONB) - Armazena dados de campos personalizados criados dinamicamente no construtor de formulários.
*   `created_at` (TIMESTAMP)

### 3. Tabela `settings`
Armazena configurações globais estruturadas como chave-valor, onde o valor é um objeto `JSONB`.
*   `key` (TEXT, Primary Key) - Chaves comuns: `form_schema`, `form_config`, `status_thresholds`, `network_alerts`, `network_alert_config`, `service_categories`, `ping_config`, `admin_users`.
*   `value` (JSONB)
*   `updated_at` (TIMESTAMP)

### 4. Tabela `action_logs`
Registra o histórico de auditoria.
*   `id` (UUID, Primary Key)
*   `user_email` (TEXT)
*   `action` (TEXT)
*   `details` (TEXT)
*   `created_at` (TIMESTAMP)

---

## ⚙️ Como Executar Localmente

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone <url-do-repositorio>
cd Intradetector
npm install
```

### 2. Configurar o Supabase
1. Crie um projeto gratuito no [Supabase](https://supabase.com/).
2. No menu **SQL Editor**, execute os scripts do projeto nesta ordem:
    1. [supabase-schema.sql](file:///c:/Users/mathe/.gemini/antigravity-ide/scratch/Intradetector/supabase-schema.sql) (Configura as tabelas estruturais, RLS iniciais e insere dados semente dos serviços padrão).
    2. [migration.sql](file:///c:/Users/mathe/.gemini/antigravity-ide/scratch/Intradetector/migration.sql) (Modifica as colunas para o formulário dinâmico, cria a tabela de logs, a função RPC `manage_auto_alert` e adiciona as configurações de ping global).

### 3. Configurar as Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto com as chaves do seu Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://sua-url-do-supabase.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=seu-token-anon-do-supabase
```

### 4. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
O projeto estará disponível em `http://localhost:3000`.

Para acessar o painel administrativo, acesse `http://localhost:3000/admin`. O acesso requer uma conta criada via autenticação do Supabase (você pode habilitar a autenticação de e-mail/senha ou outro provedor no painel do Supabase).

---

## 📂 Estrutura de Pastas

```text
Intradetector/
├── app/                  # Rotas e páginas do Next.js (App Router)
│   ├── admin/            # Painel Administrativo
│   ├── login/            # Tela de Login de administradores
│   ├── page.tsx          # Dashboard Público Principal
│   └── layout.tsx        # Layout Global da Aplicação
├── components/           # Componentes React Compartilhados
│   ├── ui/               # Componentes primitivos do Shadcn UI
│   ├── form-builder.tsx  # Construtor visual de formulário dinâmico
│   ├── report-modal.tsx  # Modal de envio de relatos público
│   └── intradetector-logo.tsx # Logo institucional
├── lib/                  # Utilitários, tipos e conexões de rede
│   ├── supabase.ts       # Inicialização do cliente Supabase do lado do cliente
│   ├── supabase-server.ts# Inicialização do cliente Supabase para o lado do servidor
│   ├── types.ts          # Interfaces e tipos do TypeScript
│   └── utils.ts          # Funções utilitárias auxiliares (cn)
├── public/               # Arquivos estáticos (imagens, favicon, etc.)
├── supabase-schema.sql   # Estrutura inicial do banco de dados
└── migration.sql         # Atualizações de banco de dados e funções customizadas
```

---

*Desenvolvido com foco em estética premium, tempo real e alta flexibilidade operacional.* 📡
