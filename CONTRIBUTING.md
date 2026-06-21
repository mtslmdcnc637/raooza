# Contribuindo para o Raooza

Obrigado por querer contribuir! Aqui estão as diretrizes.

## Como contribuir

1. Faça um fork do repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça suas alterações
4. Rode o build local: `bun run build`
5. Commit com mensagem clara: `git commit -m "feat: descrição"`
6. Push: `git push origin minha-feature`
7. Abra um Pull Request

## Stack

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Estado:** Zustand + Dexie (IndexedDB)
- **IA:** GLM (Z.ai) | OpenRouter | DeepSeek
- **Backend:** Node.js + Express

## Scripts

```bash
bun dev          # Desenvolvimento (porta 3000)
bun run build    # Build de produção
bun run lint     # ESLint
bun run db:push  # Sincronizar schema Prisma
```

## Convenções

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, etc.)
- **Componentes:** shadcn/ui style - componentes em `src/components/ui/`
- **Apps:** cada app em `src/components/apps/<nome>/`
- **Estado global:** Zustand stores em `src/stores/`
- **Banco local:** Dexie schema em `src/lib/db/`

## Ambiente

Copie `.env.example` para `.env.local` e preencha:
- `NEXT_PUBLIC_BACKEND_URL` — URL do backend (opcional)
- `NEXT_PUBLIC_MSG_BACKEND_URL` — URL do relay de mensagens (opcional)

## Pull Requests

- Mantenha PRs pequenos e focados
- Teste manualmente no navegador antes de abrir
- Descreva o que mudou e por quê
- Marque issues relacionadas

Dúvidas? Abra uma [Discussion](https://github.com/mtslmdcnc637/raooza/discussions).
