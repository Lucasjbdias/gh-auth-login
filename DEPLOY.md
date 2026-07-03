# Deploy do GesIA — guia e pré-requisitos

> **Antes de publicar:** o sistema tem **dados financeiros reais** e **ainda não tem login**.
> Publicar em URL pública sem autenticação **expõe dados sensíveis**. Resolver **autenticação/controle
> de acesso** (ou deploy privado/VPN) é **pré-requisito** para subir à web pública.

## Decisões necessárias (suas)
1. **Host:** VPS próprio (Docker) · Render · Railway · Fly.io · (Vercel exige Postgres + ajustes).
2. **Banco:** migrar SQLite → **PostgreSQL** (recomendado em nuvem) ou usar disco persistente (VPS).
3. **Autenticação:** adicionar login (ex.: Auth.js/NextAuth) + perfis — **obrigatório** antes do público.
4. **Domínio/HTTPS:** subdomínio (ex.: `gesia.francadiasgroup.com.br`) + TLS.

## Migração para PostgreSQL (quando decidir)
- `schema.prisma`: trocar `provider = "sqlite"` por `"postgresql"`; ajustar tipos se necessário.
- `DATABASE_URL` aponta para o Postgres gerenciado do host.
- `npx prisma migrate deploy` no ambiente.
- Reimportar os dados (importadores já são idempotentes).

## Opção A — Docker (VPS / Render / Railway)
Use o `Dockerfile` na raiz:
```bash
docker build -t gesia .
docker run -p 3003:3003 --env-file .env gesia
```
Variáveis: `DATABASE_URL`, `ANTHROPIC_API_KEY` (opcional), `SICOM_CRYPTO_KEY` (quando houver cofre).

## Opção B — Vercel
- Requer Postgres (Vercel Postgres/Neon). `output: "standalone"` ajuda.
- Importadores que leem arquivo (Excel/TXT) rodam em rota Node (`runtime = "nodejs"`) — OK.
- O scraper SICOM (Playwright) **não** roda em serverless da Vercel — deixar num worker/VPS à parte.

## Checklist antes do "go público"
- [ ] Login + perfis de acesso implementados.
- [ ] Banco em PostgreSQL gerenciado, com backup.
- [ ] `.env` de produção fora do Git; segredos no cofre do host.
- [ ] HTTPS + domínio.
- [ ] Revisão LGPD (dados pessoais de servidores na folha; acesso restrito).
- [ ] Logs/auditoria habilitados.

## Observação
A automação de busca no SICOM (Playwright/ddddocr) deve rodar em **servidor com navegador** (VPS/worker),
não em funções serverless. Pode ficar separada do app web.
