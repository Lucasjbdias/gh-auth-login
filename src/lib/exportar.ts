'use client'

// Exportação client-side: Excel, PDF, Word, TXT
// Lê dados de uma tabela HTML existente no DOM pelo id do container

export interface DadosExport {
  cabecalhos: string[]
  linhas: string[][]
  titulo: string
  subtitulo?: string
  nomeArquivo?: string
}

/** Lê a tabela HTML dentro do elemento com o id fornecido */
export function lerTabelaDOM(idContainer: string): { cabecalhos: string[]; linhas: string[][] } | null {
  const container = document.getElementById(idContainer)
  if (!container) return null
  const table = container.querySelector('table') ?? (container.tagName === 'TABLE' ? container as HTMLTableElement : null)
  if (!table) return null

  const cabecalhos: string[] = []
  const ths = table.querySelectorAll('thead th')
  ths.forEach((th) => cabecalhos.push((th.textContent ?? '').trim()))

  const linhas: string[][] = []
  const trs = table.querySelectorAll('tbody tr')
  trs.forEach((tr) => {
    const cells: string[] = []
    tr.querySelectorAll('td').forEach((td) => cells.push((td.textContent ?? '').trim()))
    if (cells.some((c) => c !== '')) linhas.push(cells)
  })

  return { cabecalhos, linhas }
}

/** Excel — usa a lib xlsx (já instalada) */
export async function exportarExcel(dados: DadosExport): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const wsData = [dados.cabecalhos, ...dados.linhas]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Largura automática
  const colWidths = dados.cabecalhos.map((h, i) => ({
    wch: Math.max(h.length, ...dados.linhas.map((r) => (r[i] ?? '').length), 8),
  }))
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, dados.titulo.substring(0, 31))
  XLSX.writeFile(wb, `${dados.nomeArquivo ?? dados.titulo}.xlsx`)
}

/** PDF — usa jsPDF + autoTable */
export async function exportarPDF(dados: DadosExport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: dados.cabecalhos.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })

  // Cabeçalho
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.text(dados.titulo, 14, 16)
  if (dados.subtitulo) {
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(dados.subtitulo, 14, 22)
  }
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`GesIA · França Dias Group · Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, dados.subtitulo ? 27 : 22)

  autoTable(doc, {
    head: [dados.cabecalhos],
    body: dados.linhas,
    startY: dados.subtitulo ? 31 : 27,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${dados.nomeArquivo ?? dados.titulo}.pdf`)
}

/** Word — gera HTML compatível com Word e salva como .doc */
export function exportarWord(dados: DadosExport): void {
  const linhasHTML = dados.linhas
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:10pt">${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('\n')

  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(dados.titulo)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; }
    h1   { font-size: 14pt; color: #0f172a; margin-bottom: 4pt; }
    p.sub { font-size: 9pt; color: #64748b; margin-bottom: 2pt; }
    p.gen { font-size: 8pt; color: #94a3b8; margin-bottom: 12pt; }
    table { border-collapse: collapse; width: 100%; }
    thead th { background-color: #0f766e; color: #fff; font-weight: bold; border: 1px solid #0f766e; padding: 6px 10px; font-size: 10pt; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
  </style>
</head>
<body>
  <h1>${escapeHtml(dados.titulo)}</h1>
  ${dados.subtitulo ? `<p class="sub">${escapeHtml(dados.subtitulo)}</p>` : ''}
  <p class="gen">GesIA · França Dias Group · Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  <table>
    <thead>
      <tr>${dados.cabecalhos.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>${linhasHTML}</tbody>
  </table>
</body>
</html>`

  baixarBlob(html, `${dados.nomeArquivo ?? dados.titulo}.doc`, 'application/msword')
}

/** TXT — valores separados por tabulação */
export function exportarTxt(dados: DadosExport): void {
  const sep = '\t'
  const nl = '\r\n'
  const linhas = [
    `${dados.titulo}${dados.subtitulo ? ` — ${dados.subtitulo}` : ''}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    dados.cabecalhos.join(sep),
    ...dados.linhas.map((r) => r.join(sep)),
  ]
  baixarBlob(linhas.join(nl), `${dados.nomeArquivo ?? dados.titulo}.txt`, 'text/plain;charset=utf-8')
}

// ── helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function baixarBlob(conteudo: string, nome: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
