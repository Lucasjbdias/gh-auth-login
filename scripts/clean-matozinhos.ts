import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Remove tudo que NÃO é de Matozinhos (orgao-matozinhos): dados de Capim Branco (SICOM)
// e registros de seed/exemplo. Mantém compras/execução/produtos reais de Matozinhos.
const KEEP = "orgao-matozinhos";
const SEED_FORN = [
  "Auto Posto Central Ltda", "Comercial Saúde Distribuidora", "Papelaria Escolar ME",
  "Construtora Obras & Cia", "Mecânica Frota Ltda", "Fornecedor Sem Documento",
];

async function main() {
  const antes = {
    orgaos: await db.orgao.count(),
    exercicios: await db.exercicio.count(),
    saldos: await db.saldoContabil.count(),
    secretarias: await db.secretaria.count(),
    itens: await db.itemComprado.count(),
  };
  console.log("ANTES :", JSON.stringify(antes));

  const outrosOrgaos = (await db.orgao.findMany({ where: { id: { not: KEEP } }, select: { id: true } })).map((o) => o.id);
  const exIds = (await db.exercicio.findMany({ where: { orgaoId: { in: outrosOrgaos } }, select: { id: true } })).map((e) => e.id);
  const secIds = (await db.secretaria.findMany({ where: { orgaoId: { in: outrosOrgaos } }, select: { id: true } })).map((s) => s.id);
  const licIds = (await db.licitacao.findMany({ where: { exercicioId: { in: exIds } }, select: { id: true } })).map((l) => l.id);
  const contratoIds = (await db.contrato.findMany({ where: { exercicioId: { in: exIds } }, select: { id: true } })).map((c) => c.id);
  const seedProd = (await db.produto.findMany({ where: { codigo: { startsWith: "PRD-" } }, select: { id: true } })).map((p) => p.id);

  // Apaga na ordem correta (FK)
  await db.itemComprado.deleteMany({ where: { OR: [{ licitacaoId: { in: licIds } }, { produtoId: { in: seedProd } }] } });
  await db.aditivo.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await db.empenho.deleteMany({ where: { exercicioId: { in: exIds } } });
  await db.dotacaoOrcamentaria.deleteMany({ where: { exercicioId: { in: exIds } } });
  await db.receita.deleteMany({ where: { exercicioId: { in: exIds } } });
  await db.contrato.deleteMany({ where: { exercicioId: { in: exIds } } });
  await db.licitacao.deleteMany({ where: { exercicioId: { in: exIds } } });
  await db.saldoContabil.deleteMany({}); // apenas Capim Branco até aqui
  await db.abastecimento.deleteMany({});
  await db.manutencao.deleteMany({});
  await db.veiculo.deleteMany({});
  await db.patrimonio.deleteMany({});
  await db.movimentacaoAlmoxarifado.deleteMany({});
  await db.obra.deleteMany({});
  await db.convenio.deleteMany({});
  await db.ataRegistroPreco.deleteMany({});
  await db.alerta.deleteMany({});
  await db.unidadeOrcamentaria.deleteMany({ where: { secretariaId: { in: secIds } } });
  await db.secretaria.deleteMany({ where: { id: { in: secIds } } });
  await db.exercicio.deleteMany({ where: { id: { in: exIds } } });
  await db.orgao.deleteMany({ where: { id: { in: outrosOrgaos } } });
  await db.produto.deleteMany({ where: { id: { in: seedProd } } });
  await db.fornecedor.deleteMany({ where: { nome: { in: SEED_FORN } } });

  const depois = {
    orgaos: await db.orgao.count(),
    exercicios: await db.exercicio.count(),
    saldos: await db.saldoContabil.count(),
    secretarias: await db.secretaria.count(),
    itens: await db.itemComprado.count(),
  };
  console.log("DEPOIS:", JSON.stringify(depois));
  console.log("OK — base limpa para Matozinhos.");
}

main().catch(console.error).finally(() => db.$disconnect());
