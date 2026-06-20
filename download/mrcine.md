# Mrcine

Sistema de gestão de cinemas com reserva de assentos, controle de sessões e integração com pagamentos.

## Visão Geral

O Mrcine é uma plataforma completa para redes de cinemas que permite gerenciar:
- Catálogo de filmes em cartaz
- Sessões e horários
- Reserva e compra de ingressos
- Gestão de salas e assentos
- Relatórios de bilheteria

## Próximos Passos

- [ ] Implementar integração com gateway de pagamento
- [ ] Adicionar suporte a 3D e IMAX
- [ ] Criar app mobile (React Native)
- [ ] Otimizar busca de filmes com Elasticsearch
- [ ] Implementar programa de fidelidade

## Roadmap Q3 2026

- Lançamento do módulo de eventos corporativos
- Integração com IMDb para sinopses automáticas
- API pública para parceiros

## Reuniões Agendadas

- Reunião com equipe de design: 2026-07-15
- Review com cliente: 2026-07-22
- Release da versão 2.0: 2026-08-01

## Arquitetura

O sistema é dividido em microserviços:

### Backend
- API Gateway (Node.js + Express)
- Serviço de Filmes (Python + FastAPI)
- Serviço de Reservas (Go + Gin)
- Serviço de Pagamentos (Java + Spring)

### Frontend
- Web App (Next.js 14)
- Mobile App (React Native)
- Painel Admin (React + Vite)

### Infraestrutura
- Kubernetes no GCP
- PostgreSQL para dados transacionais
- Redis para cache
- Kafka para eventos

## TODO Técnico

- [ ] Migrar autenticação para JWT com refresh tokens
- [ ] Implementar rate limiting no API Gateway
- [ ] Adicionar tracing distribuído (OpenTelemetry)
- [ ] Configurar CI/CD com GitHub Actions

## Equipe

- Tech Lead: João Silva
- Backend: Maria Santos, Pedro Costa
- Frontend: Ana Oliveira
- DevOps: Carlos Ferreira
