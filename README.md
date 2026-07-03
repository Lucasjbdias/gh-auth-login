# GesIA — Gestor Público 360

Plataforma de análise gerencial para órgãos públicos municipais. Transforma dados
públicos (receitas, despesas, compras, contratos, frota, almoxarifado) em informações
gerenciais simples, confiáveis e com alertas preventivos.

**Versão 1:** alimentação por importação de planilhas/CSV e cadastros (sem APIs externas).
A estrutura de dados já nasce preparada para integração por APIs na Versão 2 (PNCP,
sistema contábil, portais de transparência, etc.).

## Stack

- **Next.js 15** (App Router) — front-end e API interna
- **Prisma** + **SQLite** (dev) — banco gerencial; troca para PostgreSQL na v2
- **Tailwind CSS** + **Recharts** — painéis e gráficos
- **TypeScript** + **Zod**

## Como rodar

```bash
npm install        # instala dependências
npm run setup      # gera o Prisma Client, cria o banco e popula dados de exemplo
npm run dev        # inicia em http://localhost:3000
```

Comandos úteis:

| Comando             | Descrição                                            |
| ------------------- | ---------------------------------------------------- |
| `npm run db:seed`   | Repopula os dados de exemplo                         |
| `npm run db:reset`  | Recria o banco do zero e popula                      |
| `npm run db:push`   | Aplica o schema ao banco                             |
| `npm run build`     | Build de produção                                    |

## Arquitetura (camadas da especificação)

| Camada | Onde está |
| ------ | --------- |
| 1. Entrada de dados | `src/app/importacoes`, `src/app/api/importacao` |
| 2/3. Banco gerencial | `prisma/schema.prisma` |
| 4. Regras de validação | `src/lib/alerts.ts` |
| 5. Motor de indicadores | `src/lib/indicators.ts` |
| 6. Motor de alertas | `src/lib/alerts.ts` + `src/lib/parametros.ts` |
| 7. Dashboard | `src/app/**` (painéis) |
| Consultor (Módulo 10) | `src/lib/consultor.ts` + `src/app/consultor` |

## Estrutura

```
prisma/schema.prisma     # ~30 tabelas (Camada 3)
prisma/seed.ts           # município fictício com dados de exemplo
src/lib/                 # db, format, indicators, alerts, consultor, parametros
src/components/          # Sidebar, ui, Charts
src/app/                 # painéis (um diretório por módulo)
```
