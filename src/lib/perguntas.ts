// Constantes client-safe do Consultor (sem dependências de servidor).
// Mantidas separadas para poderem ser importadas em client components
// sem arrastar o motor de consultas/IA (que é server-only) para o bundle.

/** Perguntas sugeridas exibidas na interface do consultor. */
export const PERGUNTAS_SUGERIDAS = [
  "Como está a receita?",
  "Como está a despesa?",
  "Qual secretaria teve maior gasto?",
  "Quais fornecedores receberam mais?",
  "Quais contratos vencem este mês?",
  "Qual veículo mais gastou combustível?",
  "Quais produtos estão acabando?",
  "O que devo acompanhar esta semana?",
];
