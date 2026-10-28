// Estrutura de menus (Seção 23). Fonte única usada pela navegação lateral.

export interface ItemMenu {
  href: string;
  label: string;
  /** ícone como emoji simples para o MVP (sem dependência de libs de ícones). */
  icone: string;
  grupo: "Gestão" | "Cadastros" | "Inteligência" | "Comunicar" | "Sistema" | "Ajuda";
}

export const MENU: ItemMenu[] = [
  { href: "/", label: "Visão Geral", icone: "📊", grupo: "Gestão" },
  { href: "/receitas", label: "Receitas", icone: "💰", grupo: "Gestão" },
  { href: "/despesas", label: "Despesas", icone: "💸", grupo: "Gestão" },
  { href: "/compras", label: "Compras", icone: "🛒", grupo: "Gestão" },
  { href: "/contratos", label: "Contratos", icone: "📑", grupo: "Gestão" },
  { href: "/contabil", label: "Contabilidade", icone: "📒", grupo: "Gestão" },
  { href: "/produtos", label: "Produtos", icone: "📦", grupo: "Cadastros" },
  { href: "/almoxarifado", label: "Almoxarifado", icone: "🏬", grupo: "Cadastros" },
  { href: "/patrimonio", label: "Patrimônio", icone: "🏛️", grupo: "Cadastros" },
  { href: "/veiculos", label: "Veículos", icone: "🚗", grupo: "Cadastros" },
  { href: "/fornecedores", label: "Fornecedores", icone: "🏢", grupo: "Cadastros" },
  { href: "/alertas", label: "Alertas", icone: "🚨", grupo: "Inteligência" },
  { href: "/cauc", label: "CAUC", icone: "🔒", grupo: "Inteligência" },
  { href: "/comunicar", label: "Protocolos", icone: "📨", grupo: "Comunicar" },
  { href: "/comunicar/destinatarios", label: "Destinatários", icone: "👥", grupo: "Comunicar" },
  { href: "/comunicar/config-email", label: "Config. Email", icone: "📧", grupo: "Comunicar" },
  { href: "/comparativo", label: "Comparativo Anual", icone: "📈", grupo: "Inteligência" },
  { href: "/consultor", label: "Consultor de Dados", icone: "🤖", grupo: "Inteligência" },
  { href: "/relatorios", label: "Relatórios", icone: "📄", grupo: "Inteligência" },
  { href: "/importacoes", label: "Importações", icone: "📥", grupo: "Sistema" },
  { href: "/remessas", label: "Remessas SICOM", icone: "📦", grupo: "Sistema" },
  { href: "/configuracoes", label: "Configurações", icone: "⚙️", grupo: "Sistema" },
  { href: "/usuarios", label: "Usuários", icone: "👤", grupo: "Sistema" },
  { href: "/auditoria", label: "Auditoria", icone: "🔍", grupo: "Sistema" },
  { href: "/referencias-sicom", label: "Referências SICOM", icone: "📚", grupo: "Ajuda" },
  { href: "/manual", label: "Manual do Sistema", icone: "📖", grupo: "Ajuda" },
  { href: "/homologacao", label: "Homologação", icone: "✅", grupo: "Ajuda" },
];

export const GRUPOS: ItemMenu["grupo"][] = ["Gestão", "Cadastros", "Inteligência", "Comunicar", "Sistema", "Ajuda"];
