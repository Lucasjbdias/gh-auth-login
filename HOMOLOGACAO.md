# Plano de Homologação — GesIA (França Dias Group)

Versão técnica do fluxo de aceite. A versão navegável está no sistema em **Ajuda → Homologação** (`/homologacao`).

## Objetivo
Validar, fase a fase, que o GesIA está correto, confiável, rápido e pronto para uso pelo gestor, com os dados reais do município.

## Fases e critérios de aceite

### Fase 1 — Preparação do ambiente
- `npm run build` sem erros; `npm run start` no ar na porta 3003.
- Banco criado/migrado. **Pendência:** excluir `.next` da sincronização do OneDrive (evita `EBUSY`).

### Fase 2 — Importação e qualidade dos dados
- Cada importador lê e grava corretamente; **totais batem com a fonte oficial** (ex.: Compras Diretas R$ 125.353,17 = TOTAL GERAL do relatório).
- **Pendentes:** Compras 2026 e Folha de pagamento (aguardando arquivos).
- Critério: divergência de totais = 0 (ou justificada).

### Fase 3 — Testes funcionais por módulo
- Toda tela abre (HTTP 200), mostra dados coerentes e navega.
- Critério: nenhuma tela em erro; números conferem com amostras manuais.

### Fase 4 — Regras e alertas
- Alertas corretos, sem falso-positivo (inconsistência avaliada por dotação; regras ruidosas limitadas).
- **Pendente:** alerta de concentração de fornecedor a partir de NAF/compras; revisão dos parâmetros (Configurações).

### Fase 5 — Desempenho
- Telas principais < 2s; consultas por agregação/índice; sem carregar coleções enormes em memória.
- **Pendente:** teste de carga com base completa.

### Fase 6 — Segurança e perfis
- Trilha de auditoria ativa. **Pendentes:** login individual, permissões por módulo, backup.

### Fase 7 — Aceite final
- Manual no sistema (OK), vídeo de treinamento (roteiro pronto — `ROTEIRO_VIDEO_TREINAMENTO.md`), validação do gestor e termo de aceite (pendentes).

## Como conduzir a homologação assistida
1. Gestor e equipe acessam o sistema juntos.
2. Percorrem as fases na tela `/homologacao`, marcando o que validaram.
3. Anotam divergências como alertas/observações.
4. Ao concluir, registram o termo de aceite.

## Roteiro de testes rápidos (smoke)
- Importar um arquivo de cada tipo → conferir contagem e total.
- Abrir todas as telas do menu → todas em 200.
- Criar/atualizar um alerta → verificar na Auditoria.
- Consultar 3 perguntas no Consultor → respostas coerentes.
- Conferir Comparativo: variação de receita/despesa entre os dois exercícios.
