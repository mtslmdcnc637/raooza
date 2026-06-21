# Raooza — Web OS inspirado no Windows 11 com IA

Sistema operacional web completo com notas inteligentes, kanban, pomodoro, calendário, hábitos, wiki estilo Obsidian, editor tipo Notion, assistente de IA que opera o sistema via JSON, importação de markdown, command palette, templates reusáveis e snippets expansíveis.

## Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **State**: Zustand (windows, settings, system bus) + Dexie (IndexedDB para dados estruturados)
- **IA**: GLM (Z.ai) | OpenRouter (Claude/GPT/Llama/Gemini) | DeepSeek — selecionável
- **PWA**: manifest + service worker (instalável, offline-ready)

## Deploy

### Modo padrão (recomendado): Frontend only

Tudo roda no browser do usuário. A API key que ele digita em **Configurações > IA** é armazenada apenas no `localStorage` dele e enviada direto pro provedor escolhido. Nenhuma chave sua é necessária.

```bash
# 1. Push para GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin git@github.com:seu-usuario/raooza.git
git push -u origin main

# 2. Na Vercel: https://vercel.com/new
#    Importe o repo. Não configure nenhuma env var.
#    Deploy. Pronto.
```

Os usuários vão em **Configurações > IA**, escolhem o provedor (OpenRouter/DeepSeek/GLM), digitam a própria API key. O tutorial passo-a-passo ensina a pegar a chave do OpenRouter.

### Modo opcional: Backend na VPS (cache + rate-limit)

Se quiser ter um proxy na sua VPS que faz cache de respostas idênticas e rate limiting por IP, pode subir o backend incluso em `/backend`. Mesmo nesse modo, **a API key do usuário sempre tem prioridade** — o backend só usa uma chave própria (do `.env`) como fallback se o usuário não informar a dele.

```bash
# Na VPS:
git clone https://github.com/SEU_USUARIO/raooza.git
cd raooza/backend
cp .env.example .env
# Edite .env: preencha ALLOWED_ORIGINS com a URL da Vercel
# (deixe as API keys vazias — usuários vão usar as deles)
docker compose up -d

# (Opcional) HTTPS com domínio próprio via Caddy:
# 1. Aponte raooza-api.seudominio.com pro IP da VPS
# 2. Edite Caddyfile com seu domínio
# 3. Descomente o bloco caddy em docker-compose.yml
# 4. docker compose up -d

# Na Vercel, configure a env var:
# NEXT_PUBLIC_BACKEND_URL=https://raooza-api.seudominio.com
```

## Estrutura

```
raooza/
├── src/                          # Frontend Next.js
│   ├── app/
│   │   ├── page.tsx              # Boot → Login → Desktop
│   │   ├── layout.tsx            # Manifest, theme, PWA register
│   │   └── api/                  # API routes (usadas quando NEXT_PUBLIC_BACKEND_URL está vazio)
│   │       ├── ai/route.ts
│   │       ├── import-md/route.ts
│   │       └── myday/route.ts
│   ├── components/
│   │   ├── desktop/              # Boot, Login, Desktop, Taskbar, Window, etc
│   │   └── apps/                 # 14 apps (notes, kanban, pomodoro, ...)
│   ├── lib/
│   │   ├── ai/                   # providers + executor (JSON action protocol)
│   │   ├── db/                   # Dexie schema (IndexedDB)
│   │   └── os/                   # App registry + types
│   └── stores/                   # Zustand stores
├── backend/                      # Backend opcional (VPS) — proxy + cache + rate-limit
│   ├── index.js                  # Express: /api/ai, /api/import-md, /api/myday, /models/:provider
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
| ⚙️ **Configurações** | Tema, wallpaper, acento, provedor IA, API key |

## Atalhos

- `Ctrl+K` (ou `Cmd+K`) — Command Palette
- Arrastar janela pra borda — Snap layout
- Arrastar `.md` pro desktop — Importar

## Privacidade

- Sua API key fica apenas no `localStorage` do seu navegador
- Chamadas de IA vão direto do browser para o provedor (ou passam pelo seu backend opcional, mas a chave do usuário sempre tem prioridade)
- O Raooza não coleta nenhum dado pessoal
- Tudo que você cria (notas, tarefas, etc) fica no IndexedDB local

## Variáveis de ambiente

### Frontend (Vercel)

| Var | Default | Descrição |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | (vazio) | URL do backend opcional da VPS. Se vazio, usa API routes locais. |
| `ZAI_API_KEY` | (env do sandbox) | Usado só pela API route `/api/ai` quando GLM selecionado sem key do usuário. |

### Backend (VPS, opcional)

Ver `backend/.env.example`. Todas as API keys são **opcionais** — servem como fallback se o usuário não informar a própria.

## Licença

MIT.
