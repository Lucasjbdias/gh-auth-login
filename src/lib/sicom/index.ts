// Dicionários oficiais SICOM (TCE-MG 2026) embutidos no sistema.
// Gerados de scripts/gen-sicom.ts a partir das planilhas oficiais.
import receita from "./data/receita.json";
import despesa from "./data/despesa.json";
import fontes from "./data/fontes.json";
import rubricas from "./data/rubricas.json";
import pcasp from "./data/pcasp.json";

const receitaMap = receita as Record<string, string>;
const despesaMap = despesa as Record<string, { nome: string; tipo: string }>;
const fontesMap = fontes as Record<string, string>;
const rubricasMap = rubricas as Record<string, { nome: string; status: string }>;
const pcaspMap = pcasp as Record<string, string>;

const CLASSES_PCASP: Record<string, string> = {
  "1": "Ativo",
  "2": "Passivo e Patrimônio Líquido",
  "3": "Variação Patrimonial Diminutiva (despesa)",
  "4": "Variação Patrimonial Aumentativa (receita)",
  "5": "Controles da Aprovação do Planejamento e Orçamento",
  "6": "Controles da Execução do Planejamento e Orçamento",
  "7": "Controles Devedores",
  "8": "Controles Credores",
};

/** Nome oficial da conta contábil (PCASP) a partir do código (9 dígitos, com/sem pontos). */
export function nomeConta(codigo: string): string | null {
  return pcaspMap[soDigitos(codigo)] ?? null;
}

/** Classe PCASP (1º dígito) e seu nome. */
export function classeContabil(codigo: string): { classe: string; nome: string } {
  const d = soDigitos(codigo);
  const c = d[0] ?? "";
  return { classe: c, nome: CLASSES_PCASP[c] ?? "Outras" };
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Nome oficial da natureza da receita a partir do código (com ou sem pontos). */
export function nomeReceita(codigo: string): string | null {
  const d = soDigitos(codigo);
  return receitaMap[d] ?? receitaMap[d.padEnd(8, "0")] ?? null;
}

/** Nome oficial da natureza da despesa (ex.: "3.3.90.32.00"). */
export function nomeDespesa(codigo: string): string | null {
  return despesaMap[codigo]?.nome ?? null;
}

/** Nome oficial da fonte de recurso a partir do código completo ("1.500.000.0000"). */
export function nomeFonte(codigoCompleto: string): string | null {
  const d = soDigitos(codigoCompleto);
  // Estrutura: 1º dígito grupo + dígitos 2-4 especificação (código principal).
  const principal = d.slice(1, 4);
  return fontesMap[principal] ?? null;
}

/** Natureza da rubrica da folha a partir do código. */
export function naturezaRubrica(codigo: string): { nome: string; status: string } | null {
  return rubricasMap[soDigitos(codigo)] ?? null;
}

/** Resumo para a tela de referências. */
export function resumoSicom() {
  return {
    receita: Object.keys(receitaMap).length,
    despesa: Object.keys(despesaMap).length,
    fontes: Object.keys(fontesMap).length,
    rubricas: Object.keys(rubricasMap).length,
  };
}

export function amostra(tabela: "receita" | "despesa" | "fontes" | "rubricas", busca = "", limite = 50) {
  const q = busca.trim().toLowerCase();
  const filtra = (cod: string, nome: string) =>
    !q || cod.toLowerCase().includes(q) || nome.toLowerCase().includes(q);
  if (tabela === "receita")
    return Object.entries(receitaMap).filter(([c, n]) => filtra(c, n)).slice(0, limite).map(([codigo, nome]) => ({ codigo, nome }));
  if (tabela === "despesa")
    return Object.entries(despesaMap).filter(([c, v]) => filtra(c, v.nome)).slice(0, limite).map(([codigo, v]) => ({ codigo, nome: `${v.nome} (${v.tipo})` }));
  if (tabela === "fontes")
    return Object.entries(fontesMap).filter(([c, n]) => filtra(c, n)).slice(0, limite).map(([codigo, nome]) => ({ codigo, nome }));
  return Object.entries(rubricasMap).filter(([c, v]) => filtra(c, v.nome)).slice(0, limite).map(([codigo, v]) => ({ codigo, nome: `${v.nome} [${v.status}]` }));
}
