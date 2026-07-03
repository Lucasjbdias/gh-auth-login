import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const MUNICIPIOS = [
  { municipio: 'Prudente de Morais', slug: 'prudente-de-morais-mg', ibge: '3153905', populacao: 10900 },
  { municipio: 'Matozinhos',         slug: 'matozinhos-mg',         ibge: '3141108', populacao: 37200 },
  { municipio: 'Capim Branco',       slug: 'capim-branco-mg',       ibge: '3112307', populacao: 10500 },
  { municipio: 'Caetanópolis',       slug: 'caetanopolis-mg',       ibge: '3110004', populacao: 9200  },
  { municipio: 'Jequitibá',          slug: 'jequitiba-mg',          ibge: '3135456', populacao: 5600  },
  { municipio: 'Santana do Riacho',  slug: 'santana-do-riacho-mg',  ibge: '3158201', populacao: 4800  },
]

async function main() {
  console.log('Iniciando seed GesIA v2...')

  // -----------------------------------------------------------------------
  // Estado MG
  // -----------------------------------------------------------------------
  const mg = await prisma.estado.upsert({
    where: { uf: 'MG' },
    update: {},
    create: { nome: 'Minas Gerais', uf: 'MG', regiao: 'Sudeste' },
  })
  console.log(`Estado: ${mg.nome}`)

  // -----------------------------------------------------------------------
  // Usuário DEV (tenantId = null, acesso global)
  // -----------------------------------------------------------------------
  const devHash = await bcrypt.hash('Gfrancadias@2026', 12)
  const devUser = await prisma.usuario.upsert({
    where: { email: 'lucas@francadias.com.br' },
    update: { senhaHash: devHash },
    create: {
      tenantId:  null,
      nome:      'Lucas França Dias',
      email:     'lucas@francadias.com.br',
      senhaHash: devHash,
      nivel:     'DEV',
      ativo:     true,
    },
  })
  console.log(`DEV: ${devUser.email}`)

  // -----------------------------------------------------------------------
  // Integrations config defaults globais (tenantId = null)
  // -----------------------------------------------------------------------
  const integracoesPadrao = [
    { tipo: 'SICOM_TCE_MG',         nome: 'SICOM TCE-MG',                    descricao: 'Importação de dados orçamentários e financeiros via SICOM' },
    { tipo: 'SICONFI',              nome: 'SICONFI / STN',                    descricao: 'Relatórios fiscais e transferências constitucionais' },
    { tipo: 'PNCP',                 nome: 'PNCP — Compras Gov',               descricao: 'Plano de Contratações Anual e contratos públicos' },
    { tipo: 'TCE_DADOS_ABERTOS',    nome: 'TCE-MG Dados Abertos',             descricao: 'dadosabertos.tce.mg.gov.br' },
    { tipo: 'TESOURO_TRANSPARENTE', nome: 'Tesouro Transparente',             descricao: 'Transferências constitucionais realizadas' },
    { tipo: 'PORTAL_TRANSPARENCIA', nome: 'Portal Transparência Federal',     descricao: 'Convênios, emendas e repasses federais' },
    { tipo: 'IBGE',                 nome: 'IBGE Cidades',                     descricao: 'Dados socioeconômicos municipais' },
    { tipo: 'RADAR_TRANSPARENCIA',  nome: 'Radar da Transparência',           descricao: 'radardatransparencia.atricon.org.br' },
    { tipo: 'IEGM_MG',              nome: 'IEGM TCE-MG',                      descricao: 'Índice de Efetividade da Gestão Municipal' },
    { tipo: 'BANCO_PRECOS',         nome: 'Banco de Preços TCE-MG',           descricao: 'Preços referenciais para licitações' },
    { tipo: 'CENSO_ESCOLAR',        nome: 'Censo Escolar — INEP',             descricao: 'Dados educacionais municipais' },
    { tipo: 'LEGISWEB',             nome: 'Legisweb',                         descricao: 'Legislação municipal e estadual' },
    { tipo: 'CAPMG',                nome: 'CAPMG',                            descricao: 'Cadastro de Adimplência Previdenciária MG' },
    { tipo: 'SISOP_MG',             nome: 'SISOP-MG',                         descricao: 'Sistema de Obras Públicas MG' },
    { tipo: 'EMENDAS_ESTADUAIS',    nome: 'Emendas Parlamentares Estaduais',  descricao: 'ALMG — emendas ao orçamento estadual' },
    { tipo: 'MCASP',                nome: 'MCASP / MDF — STN',                descricao: 'Parâmetros técnicos anuais do Tesouro Nacional' },
  ]

  for (const i of integracoesPadrao) {
    await prisma.integracaoConfig.upsert({
      where: { id: `global-${i.tipo}` },
      update: {},
      create: {
        id:        `global-${i.tipo}`,
        tenantId:  null,
        tipo:      i.tipo,
        nome:      i.nome,
        descricao: i.descricao,
        ativo:     false,
        config:    '{}',
      },
    })
  }
  console.log(`Integrações globais: ${integracoesPadrao.length} slots configurados`)

  // -----------------------------------------------------------------------
  // Parâmetros técnicos LRF/CF vigentes
  // -----------------------------------------------------------------------
  const params = [
    { chave: 'LIMITE_PESSOAL_EXECUTIVO',   valor: '54',  descricao: 'Limite despesa com pessoal — Executivo (% RCL) — LRF art. 20' },
    { chave: 'LIMITE_PESSOAL_LEGISLATIVO', valor: '6',   descricao: 'Limite despesa com pessoal — Legislativo (% RCL) — LRF art. 20' },
    { chave: 'PCT_MDE_MINIMO',             valor: '25',  descricao: 'Mínimo aplicação MDE (% impostos) — CF art. 212' },
    { chave: 'PCT_SAUDE_MINIMO',           valor: '15',  descricao: 'Mínimo aplicação Saúde (% RCL) — EC 29' },
    { chave: 'PCT_FUNDEB_PROF',            valor: '70',  descricao: 'Mínimo FUNDEB com profissionais do magistério — Lei 14.113/2020' },
    { chave: 'LIMITE_DIVIDA_RCL',          valor: '120', descricao: 'Limite Dívida Consolidada Líquida (% RCL) — Res. Senado 40/2001' },
  ]

  for (const p of params) {
    await prisma.parametroTecnico.upsert({
      where: { exercicio_tipo_chave: { exercicio: 2026, tipo: 'LIMITE_LRF', chave: p.chave } },
      update: {},
      create: {
        exercicio:      2026,
        tipo:           'LIMITE_LRF',
        chave:          p.chave,
        valor:          p.valor,
        descricao:      p.descricao,
        vigenciaInicio: new Date('2026-01-01'),
      },
    })
  }
  console.log('Parâmetros técnicos: OK')

  // -----------------------------------------------------------------------
  // Loop de tenants (municípios de teste)
  // -----------------------------------------------------------------------
  for (const m of MUNICIPIOS) {
    const nomeCompleto = `Prefeitura Municipal de ${m.municipio}`

    const tenant = await prisma.tenant.upsert({
      where:  { slug: m.slug },
      update: {},
      create: {
        estadoId:   mg.id,
        nome:       nomeCompleto,
        municipio:  m.municipio,
        slug:       m.slug,
        codigoIBGE: m.ibge,
        populacao:  m.populacao,
        plano:      'ESSENCIAL',
        ativo:      true,
      },
    })

    // Órgão principal — Prefeitura
    const orgao = await prisma.orgao.upsert({
      where: { id: `org-${m.slug}` },
      update: {},
      create: {
        id:        `org-${m.slug}`,
        tenantId:  tenant.id,
        nome:      nomeCompleto,
        tipo:      'PREFEITURA',
        municipio: m.municipio,
        uf:        'MG',
        esfera:    'MUNICIPAL',
        codigo:    '01',
        ativo:     true,
      },
    })

    // Exercícios
    for (const ano of [2024, 2025, 2026]) {
      await prisma.exercicio.upsert({
        where:  { orgaoId_ano: { orgaoId: orgao.id, ano } },
        update: {},
        create: { orgaoId: orgao.id, ano, aberto: ano >= 2025 },
      })
    }

    // TENANT_ADMIN
    const adminEmail = `admin@${m.slug}.gesia.com.br`
    const adminHash  = await bcrypt.hash('Admin@2026', 12)
    await prisma.usuario.upsert({
      where:  { email: adminEmail },
      update: { senhaHash: adminHash },
      create: {
        tenantId:  tenant.id,
        nome:      `Administrador — ${m.municipio}`,
        email:     adminEmail,
        senhaHash: adminHash,
        nivel:     'TENANT_ADMIN',
        ativo:     true,
      },
    })

    // DEMO
    const demoEmail = `demo@${m.slug}.gesia.com.br`
    const demoHash  = await bcrypt.hash('Demo@2026', 10)
    await prisma.usuario.upsert({
      where:  { email: demoEmail },
      update: {},
      create: {
        tenantId:  tenant.id,
        nome:      `Demonstração — ${m.municipio}`,
        email:     demoEmail,
        senhaHash: demoHash,
        nivel:     'DEMO',
        ativo:     true,
      },
    })

    // Integração SICOM pré-configurada com código IBGE
    await prisma.integracaoConfig.upsert({
      where: { id: `tenant-sicom-${tenant.id}` },
      update: {},
      create: {
        id:        `tenant-sicom-${tenant.id}`,
        tenantId:  tenant.id,
        tipo:      'SICOM_TCE_MG',
        nome:      'SICOM TCE-MG',
        descricao: `Dados SICOM para ${m.municipio}`,
        ativo:     false,
        config:    JSON.stringify({ municipioIBGE: m.ibge, municipio: m.municipio }),
      },
    })

    console.log(`  OK ${m.municipio} | admin: ${adminEmail}`)
  }

  // -----------------------------------------------------------------------
  // Parâmetros gerais
  // -----------------------------------------------------------------------
  for (const [chave, valor, descricao] of [
    ['SISTEMA_NOME',       'GesIA Municipal 360', 'Nome do sistema'],
    ['SISTEMA_VERSAO',     '2.0.0',               'Versão do sistema'],
    ['SISTEMA_UF_PADRAO',  'MG',                  'UF padrão de operação'],
  ] as [string, string, string][]) {
    await prisma.parametro.upsert({
      where:  { chave },
      update: {},
      create: { chave, valor, descricao },
    })
  }

  console.log('\nSeed concluído.')
  console.log('DEV:    lucas@francadias.com.br / Gfrancadias@2026')
  console.log('ADMIN:  admin@<slug>.gesia.com.br / Admin@2026')
  console.log('DEMO:   demo@<slug>.gesia.com.br / Demo@2026')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
