# Raooza — Web OS inspirado no Windows 11 com IA

Sistema operacional web completo com notas inteligentes, kanban, pomodoro, calendário, hábitos, wiki estilo Obsidian, editor tipo Notion, assistente de IA que opera o sistema via JSON, importação de markdown, command palette, templates reusáveis e snippets expansíveis.

## Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (windows, settings, system bus) + Dexie (IndexedDB para dados estruturados)
- **IA**: GLM (Z.ai) | OpenRouter (Claude/GPT/Llama/Gemini) | DeepSeek — selecionável
- **PWA**: manifest + service worker (instalável, offline-ready)

## Deploy rápido

### Opção A — Frontend only (Vercel grátis) + chaves de IA no navegador

Mais simples. As chamadas de IA vão direto do browser para o provedor (OpenRouter/DeepSeek). A API key fica no localStorage do usuário.

```bash
# 1. Push para GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin git@github.com:seu-usuario/raooza.git
git push -u origin main

# 2. Na Vercel
# Importe o repo em https://vercel.com/new
# A Vercel detecta Next.js automaticamente
# Não precisa de nenhuma env var — clique em Deploy
```

### Opção B — Frontend (Vercel) + Backend (sua VPS) — RECOMENDADO

O backend na VPS guarda as API keys no ambiente. O frontend Vercel só fala com seu backend. Mais seguro, e permite rate limiting + cache.

```bash
# 1. Deploy do backend na VPS
cd backend
cp .env.example .env
# Edite .env e preencha OPENROUTER_API_KEY=sk-or-v1-...
docker compose up -d
# Teste: curl http://sua-vps:8787/health

# 2. (Opcional) Configure HTTPS com Caddy
# Edite backend/Caddyfile com seu domínio (ex: raooza-api.seudominio.com)
# Descomente o bloco caddy em backend/docker-compose.yml
docker compose up -d

# 3. Deploy do frontend na Vercel
# Importe o repo, e configure a env var:
# NEXT_PUBLIC_BACKEND_URL=https://raooza-api.seudominio.com
# Deploy
```

## Estrutura

```
raooza/
├── src/                          # Frontend Next.js
│   ├── app/
│   │   ├── page.tsx              # Boot → Login → Desktop
│   │   ├── layout.tsx            # Manifest, theme, PWA register
│   │   └── api/                  # API routes (fallback quando sem backend)
│   │       ├── ai/route.ts       # POST /api/ai
│   │       ├── import-md/route.ts# POST /api/import-md
│   │       └── myday/route.ts    # POST /api/myday
│   ├── components/
│   │   ├── desktop/              # Boot, Login, Desktop, Taskbar, Window, etc
│   │   └── apps/                 # 14 apps (notes, kanban, pomodoro, ...)
│   ├── lib/
│   │   ├── ai/                   # providers + executor (JSON action protocol)
│   │   ├── db/                   # Dexie schema (IndexedDB)
│   │   └── os/                   # App registry + types
│   └── stores/                   # Zustand stores
├── backend/                      # Backend standalone (VPS)
│   ├── index.js                  # Express server: /api/ai, /api/import-md, /api/myday, /models/:provider
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── Caddyfile                 # HTTPS com Let's Encrypt
│   └── .env.example
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   └── icons/                    # 192/512/180/32 PNG
├── vercel.json                   # Config Vercel (maxDuration 300s p/ import-md)
└── package.json
```

## Apps incluídos

| App | Função |
|---|---|
| 🧠 **Meu Dia** | IA sugere 3-5 prioridades do dia com base no seu contexto |
| 📝 **Notas** | Editor com sticky notes fixáveis no desktop |
| 📋 **Kanban** | Drag & drop, vincular tarefas a notas/pomodoros |
| ⏱️ **Pomodoro** | 3 fases, ciclos automáticos, estatísticas |
| 📄 **Editor** | Blocos estilo Notion + IA para resumir/continuar texto |
| 🤖 **Assistente IA** | Chat que opera o sistema via JSON |
| 📅 **Calendário** | Mês/semana, eventos vinculados a tarefas |
| 🔥 **Hábitos** | Diários/semanais com streak e check-in |
| ⏰ **Time Tracker** | Timer vinculado a tarefas kanban |
| 📚 **Wiki** | Estilo Obsidian com `[[links]]`, backlinks, grafo |
| 📋 **Templates** | 7 built-ins (reunião, retro, PRD, brainstorm...) |
| ⚡ **Snippets** | `/trigger` + espaço expande em qualquer campo |
| 📁 **Arquivos** | Navegação por notas/docs/tarefas/eventos/wiki/hábitos |
| ⬆️ **Importar MD** | Arraste um .md → IA configura o ambiente |
| ⚙️ **Configurações** | Tema, wallpaper, acento, provedor IA |

## Atalhos

- `Ctrl+K` (ou `Cmd+K`) — Command Palette
- Arrastar janela pra borda — Snap layout
- Arrastar `.md` pro desktop — Importar

## Variáveis de ambiente

### Frontend (Vercel)

| Var | Default | Descrição |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | (vazio) | URL do backend da VPS. Se vazio, usa API routes locais. |
| `ZAI_API_KEY` | (env do sandbox) | Usado só pela API route `/api/ai` quando sem backend. |

### Backend (VPS)

Ver `backend/.env.example`.

## Licença

MIT.
