# GesIA — Estado do projeto e retomada

_Última atualização: sessão de 25/06/2026 (madrugada)._

Sistema de gestão pública (Matozinhos/MG). Stack: Next.js 15 + Prisma + SQLite + Tailwind + Recharts. Porta **3003**.

## Como subir o app

```bash
npm run build      # gera o build de produção
npm run start      # sobe em http://localhost:3003 (estável; NÃO usar dev nesta pasta — ver abaixo)
```

> **OneDrive + `.next`:** esta pasta é sincronizada pelo OneDrive, que trava arquivos de `.next` durante a recompilação incremental do `next dev` (erros `EBUSY`, páginas 500 intermitentes). Por isso, **use `npm run start` (produção)**, que serve o build pronto sem recompilar. Recomendado: excluir a pasta `.next` da sincronização do OneDrive (clicar com botão direito em `.next` → "Sempre manter neste dispositivo" desligado / ou mover o projeto para fora do OneDrive).

## Dados já carregados (Matozinhos)

| Fonte | Importador | Conteúdo |
| --- | --- | --- |
| EXEC_ORC 2025/2026 (xlsx) | EXECUCAO_ORCAMENTARIA | Receitas + despesas (empenhado/liquidado/pago) |
| produtos.xlsx | PRODUTOS | 39.722 produtos do catálogo |
| QRP Controle de Compras (xls) | CONTROLE_COMPRAS | 2.027 itens por produto |
| Relação de NAF (txt) | RELACAO_NAF | 207 NAFs, fornecedores com CNPJ, nomes de unidades |
| Compras Diretas (txt) | COMPRAS_DIRETAS | 72 itens (dispensa) |
| Demonstrativo de Despesa (txt) | DEMO_DESPESA | Nomes de unidades + funções |

## Importadores (arquitetura de plugins)

`src/lib/importers/` — cada formato é um `Importer` com `detectar()` + `importar()`, registrado em `registry.ts`. A API (`/api/importacao`) detecta o formato automaticamente. Para adicionar um formato: criar o arquivo + registrar.

- `ItemComprado.origemImport` separa as fontes de compras (cada importador limpa só o que é seu).
- Relatórios texto vêm em **latin1** (decode com fallback).

## Como importar os PRÓXIMOS arquivos (quando você anexar)

1. **Compras 2026** (mesmos formatos QRP/NAF/Compras Diretas): só subir pela tela **Importações** ou via API — entra automático e vincula ao exercício pelo nº do processo/ano.
2. **Folha de pagamento**: precisa de um **novo importador** (`src/lib/importers/folha.ts`) + módulo de comparação verba-a-verba / lotação. Definir com base na planilha: granularidade (servidor / verba / lotação) e competência (mês/ano).

```bash
# subir um arquivo pela API (exemplo)
curl -s -X POST -F "file=@CAMINHO\ARQUIVO" http://localhost:3003/api/importacao
```

## Telas (http://localhost:3003)

Visão Geral · Receitas · Despesas (com **Despesa por função**) · Compras · Contratos · Produtos · Almoxarifado · Patrimônio · Veículos · Fornecedores · Alertas · **Comparativo Anual** (desvios 2025×2026, período equivalente) · Consultor de Dados · Relatórios · Importações · Configurações · Usuários · Auditoria.

## Pendências / próximos passos sugeridos

- [ ] Importar **compras 2026** e **folha** quando os arquivos saírem.
- [ ] Concluir o onboarding do **Cowork** (papel / plugins / conectores — é interativo, precisa do usuário).
- [ ] (Opcional) Alerta de **concentração de fornecedor** a partir de NAF/compras diretas.
- [ ] (Opcional) Mapear secretarias que ainda aparecem como "U.O. x.y" (2.15/2.16/2.17/0.0 — não vieram nos demonstrativos).
- [ ] Consultor IA: colar `ANTHROPIC_API_KEY` (rotacionada) no `.env` para ativar respostas por IA.

## Notas de operação para o assistente

- Subir servidor: `Start-Process npm.cmd run start` em comando **foreground curto** (sem loop de espera no mesmo comando, senão o harness manda pra segundo plano e mata o processo-filho ao concluir). Verificar readiness em comando separado.
- Após editar libs/páginas: como `dev` é instável aqui, rodar `npm run build` e reiniciar `npm run start`.
- PID do servidor salvo em `.server.pid`.
