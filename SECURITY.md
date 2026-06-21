# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|--------|-----------|
| 0.x    | Sim       |

## Reportando vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança, **não abra uma issue pública**. Envie um email para mtslmdcnc637@gmail.com.

Inclua:
- Descrição do problema
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (se houver)

Você receberá uma resposta em até 48h. Se confirmado, trabalharemos em uma correção antes de divulgar publicamente.

## Escopo

- Autenticação e chaves de API
- Vazamento de dados via IndexedDB/localStorage
- Falhas de CORS no backend
- Injeção de script via conteúdo markdown importado

O Raooza usa criptografia E2E (libsodium) para mensagens — o backend nunca vê plaintext. Mesmo assim, reporte qualquer falha encontrada.
