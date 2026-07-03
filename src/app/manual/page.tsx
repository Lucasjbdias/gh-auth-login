import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

// Manual do usuário acessível dentro do sistema (menu Ajuda → Manual).

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <Card>
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-lg font-bold text-brand-700">{titulo}</h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
      </Card>
    </section>
  );
}

const INDICE = [
  ["o-que-e", "1. O que é o GesIA"],
  ["primeiros-passos", "2. Primeiros passos"],
  ["navegacao", "3. Como navegar"],
  ["importacao", "4. Importar dados"],
  ["paineis", "5. Os painéis"],
  ["alertas", "6. Alertas e como tratá-los"],
  ["comparativo", "7. Comparativo anual e desvios"],
  ["consultor", "8. Consultor de Dados"],
  ["confiabilidade", "9. Confiabilidade dos dados"],
  ["perfis", "10. Perfis de acesso"],
  ["faq", "11. Perguntas frequentes"],
];

export default function ManualPage() {
  return (
    <div>
      <PageHeader
        titulo="Manual do Sistema"
        descricao="Guia de uso do GesIA — França Dias Group"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Índice */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Índice</p>
            <nav className="space-y-1 text-sm">
              {INDICE.map(([id, t]) => (
                <a key={id} href={`#${id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-brand-50 hover:text-brand-700">
                  {t}
                </a>
              ))}
            </nav>
          </Card>
        </aside>

        <div className="space-y-6">
          <Secao id="o-que-e" titulo="1. O que é o GesIA">
            <p>
              O <strong>GesIA</strong> é a plataforma de inteligência de gestão pública da <strong>França Dias Group</strong>.
              Ele transforma os dados do município (receitas, despesas, compras, contratos, frota, almoxarifado) em
              informações gerenciais simples, confiáveis e com <strong>alertas preventivos</strong>.
            </p>
            <p>
              O objetivo é responder perguntas do dia a dia: quanto foi arrecadado, quanto já foi gasto, qual secretaria
              consome mais, quais contratos vencem, quais fornecedores concentram pagamentos, onde há risco — e o que
              mudou de um ano para o outro.
            </p>
          </Secao>

          <Secao id="primeiros-passos" titulo="2. Primeiros passos">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Acesse o sistema pelo endereço informado pela sua equipe (ex.: <code className="rounded bg-slate-100 px-1">http://localhost:3003</code>).</li>
              <li>Na <Link href="/" className="text-brand-600 underline">Visão Geral</Link> você vê os números do exercício atual.</li>
              <li>Importe os dados na tela <Link href="/importacoes" className="text-brand-600 underline">Importações</Link> (seção 4).</li>
              <li>Acompanhe os <Link href="/alertas" className="text-brand-600 underline">Alertas</Link> e use o <Link href="/consultor" className="text-brand-600 underline">Consultor</Link> para perguntas.</li>
            </ol>
          </Secao>

          <Secao id="navegacao" titulo="3. Como navegar">
            <p>O menu lateral organiza o sistema em grupos:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Gestão</strong>: Visão Geral, Receitas, Despesas, Compras, Contratos.</li>
              <li><strong>Cadastros</strong>: Produtos, Almoxarifado, Patrimônio, Veículos, Fornecedores.</li>
              <li><strong>Inteligência</strong>: Alertas, Comparativo Anual, Consultor de Dados, Relatórios.</li>
              <li><strong>Sistema</strong>: Importações, Configurações, Usuários, Auditoria.</li>
              <li><strong>Ajuda</strong>: este Manual e a Homologação.</li>
            </ul>
          </Secao>

          <Secao id="importacao" titulo="4. Importar dados">
            <p>
              Na tela <Link href="/importacoes" className="text-brand-600 underline">Importações</Link>, escolha
              <strong> Detecção automática</strong> (recomendado), selecione o arquivo e clique em <strong>Importar</strong>.
              O sistema reconhece o formato sozinho. Formatos suportados hoje:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Execução Orçamentária</strong> (planilha SICOM/TCE-MG) — receitas e despesas.</li>
              <li><strong>Catálogo de Produtos</strong> (planilha).</li>
              <li><strong>Controle de Compras por Produto</strong> (relatório QRP).</li>
              <li><strong>Relação de NAF</strong> — fornecedores, CNPJ e itens autorizados.</li>
              <li><strong>Compras Diretas</strong> (dispensa).</li>
              <li><strong>Demonstrativo da Despesa</strong> — nomes de unidades e funções.</li>
              <li><strong>CSV genérico</strong> — qualquer CSV, com validação de formato.</li>
            </ul>
            <p className="text-slate-500">Cada importação fica registrada no histórico (arquivo, responsável, total, erros, data).</p>
          </Secao>

          <Secao id="paineis" titulo="5. Os painéis">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Receitas</strong>: previsto × arrecadado, por mês e por origem.</li>
              <li><strong>Despesas</strong>: fixado, empenhado, liquidado, pago; por secretaria, elemento e <em>função</em>.</li>
              <li><strong>Compras / Contratos</strong>: licitações, modalidades, vencimentos, variação de preço.</li>
              <li><strong>Almoxarifado / Produtos</strong>: estoque, produtos críticos, curva de grupos.</li>
              <li><strong>Veículos</strong>: custo por veículo, combustível, manutenção, consumo.</li>
              <li><strong>Fornecedores</strong>: ranking e concentração de compras.</li>
            </ul>
            <p>Em todos os painéis os valores estão em reais (R$) e seguem o exercício ativo.</p>
          </Secao>

          <Secao id="alertas" titulo="6. Alertas e como tratá-los">
            <p>Os alertas são classificados por gravidade:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><span className="font-semibold text-green-700">Verde</span> — situação normal.</li>
              <li><span className="font-semibold text-yellow-700">Amarelo</span> — atenção (ex.: contrato vencendo).</li>
              <li><span className="font-semibold text-orange-700">Laranja</span> — risco médio.</li>
              <li><span className="font-semibold text-red-700">Vermelho</span> — crítico (ex.: inconsistência contábil).</li>
            </ul>
            <p>
              Na tela <Link href="/alertas" className="text-brand-600 underline">Alertas</Link>, abra um alerta, registre a
              <strong> providência</strong> e atualize o <strong>status</strong> (Em análise, Justificado, Resolvido…). Toda
              ação fica registrada na <Link href="/auditoria" className="text-brand-600 underline">Auditoria</Link>.
            </p>
          </Secao>

          <Secao id="comparativo" titulo="7. Comparativo anual e desvios">
            <p>
              A tela <Link href="/comparativo" className="text-brand-600 underline">Comparativo Anual</Link> une a execução de
              dois exercícios e mostra os <strong>desvios</strong> de um ano para o outro — por origem de receita, por
              elemento de despesa e por unidade. A comparação usa o <strong>período equivalente</strong> (mesmos meses nos
              dois anos), para que o desvio reflita mudança real e não meses ainda não executados.
            </p>
          </Secao>

          <Secao id="consultor" titulo="8. Consultor de Dados">
            <p>
              No <Link href="/consultor" className="text-brand-600 underline">Consultor</Link> você pergunta em linguagem
              simples ("Como está a despesa?", "Quais contratos vencem este mês?") e recebe a resposta com o indicador
              usado, a fonte, o período, eventual alerta, uma recomendação e o link para o detalhe.
            </p>
          </Secao>

          <Secao id="confiabilidade" titulo="9. Confiabilidade dos dados">
            <p>
              Cada dado importado guarda origem, data de importação, responsável e status de validação. Assim o gestor
              sabe se a informação é confiável, incompleta ou pendente — e pode rastrear do resumo até o documento de origem.
            </p>
          </Secao>

          <Secao id="perfis" titulo="10. Perfis de acesso">
            <p>
              O acesso é por perfil: Administrador, Gestor Principal, Secretário, Controle Interno, Contabilidade, Compras,
              Almoxarifado, Frota e Consulta — cada um vê o que é pertinente à sua função (ver <Link href="/usuarios" className="text-brand-600 underline">Usuários</Link>).
            </p>
          </Secao>

          <Secao id="faq" titulo="11. Perguntas frequentes">
            <p><strong>Importei e não apareceu nada?</strong> Confira se o exercício do arquivo é o exercício ativo e atualize a página.</p>
            <p><strong>Os nomes das secretarias estão como "U.O. 2.5"?</strong> Importe a Relação de NAF / Demonstrativo de Despesa, que trazem os nomes reais.</p>
            <p><strong>Posso reimportar o mesmo arquivo?</strong> Sim — a importação é idempotente; não duplica.</p>
            <p><strong>Quem vê o quê?</strong> Depende do perfil de acesso do usuário.</p>
          </Secao>

          <p className="pt-2 text-center text-xs text-slate-400">
            GesIA · França Dias Group — Manual do Sistema. Em caso de dúvida, fale com a equipe de suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
