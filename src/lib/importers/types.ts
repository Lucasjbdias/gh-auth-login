import type { WorkBook } from "xlsx";

// =====================================================================
// Framework de IMPORTADORES (Camada 1 — Entrada de Dados).
//
// Cada formato de arquivo (execução orçamentária, contratos, frota, folha,
// PNCP, etc.) é um Importer independente. O registry (registry.ts) detecta
// automaticamente qual importador atende ao arquivo enviado e o executa.
//
// Para adicionar um novo formato, basta criar um arquivo em src/lib/importers/
// que exporte um Importer e registrá-lo em registry.ts. Nada mais muda.
// =====================================================================

/** Contexto de detecção/parse, montado uma única vez pelo registry. */
export interface DetectContext {
  nomeArquivo: string;
  /** extensão em minúsculas, com ponto (ex.: ".xlsx"). */
  extensao: string;
  /** dica opcional escolhida pelo usuário no formulário (id do importador). */
  tipoHint?: string;
  /** preenchido quando o arquivo é Excel. */
  workbook?: WorkBook;
  sheetNames?: string[];
  /** preenchido quando o arquivo é texto/CSV. */
  textoCsv?: string;
}

/** Resultado padronizado de qualquer importação. */
export interface ImportResult {
  /** total de registros persistidos/processados. */
  registros: number;
  /** frase pronta para exibição na interface. */
  resumo: string;
  /** alertas recalculados após a importação, se aplicável. */
  alertasGerados?: number;
  /** mensagens não-fatais (campos ignorados, abas ausentes, etc.). */
  avisos: string[];
  /** dados estruturados específicos do importador (totais, ano, etc.). */
  dados?: Record<string, unknown>;
}

export interface Importer {
  /** identificador estável (kebab/upper) usado como tipoHint. */
  id: string;
  /** nome amigável exibido na interface. */
  nome: string;
  descricao: string;
  /** extensões aceitas (para a UI e o atributo accept do input). */
  formatos: string[];
  /**
   * Pontuação de detecção para este arquivo: 0 = não atende; quanto maior,
   * mais específico/confiante. O registry escolhe o de maior pontuação.
   */
  detectar(ctx: DetectContext): number;
  /** Executa a importação e persiste os dados. */
  importar(buffer: Buffer, ctx: DetectContext): Promise<ImportResult>;
}
