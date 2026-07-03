# Busca automática de arquivos no SICOM — Instruções do processo

> **Uso responsável.** Este processo usa as **credenciais do próprio município** para acessar os
> **próprios dados** do município no portal SICOM/TCE-MG — uso administrativo legítimo. Ainda assim:
> 1. Confirme que o município autoriza a automação do acesso.
> 2. Verifique os **termos de uso** do portal — a resolução automática de CAPTCHA pode ser restrita.
> 3. Se houver **canal oficial** de download em lote ou API/serviço de dados abertos, **prefira-o**.
> 4. Faça acesso **moderado** (sem paralelismo agressivo), respeitando o portal.
> As credenciais ficam **cifradas (AES)** e nunca aparecem em log.

## Objetivo
Baixar automaticamente os arquivos **homologados** que o município enviou ao SICOM (remessas dos
módulos: Balancete, FLPG/Folha, Cadastro Básico/Item, Edital e Licitação, Obra, etc.) e
**importar** no GesIA pelos importadores já existentes (detecção automática).

## Fluxo (visão geral)
1. **Credenciais do município** (usuário + senha) salvas **cifradas (AES-256-GCM)**.
2. **Playwright** abre o SICOM e captura a imagem do **CAPTCHA**.
3. **OCR de CAPTCHA** (ddddocr — gratuito, sem API externa) resolve o texto.
4. Se o login falhar → **tenta novamente** (máx. 5x); senão, aborta e notifica.
5. Navega até a área de **arquivos homologados** e localiza os itens da **lista configurada**.
6. **Baixa os ZIPs** → descompacta → **importa automaticamente** (`/api/importacao`).

## Navegação no portal (mapa do menu principal)
Portal de **envio** (ex.: `costarica.tce.mg.gov.br`), modo **ENVIO REAL**. Após login, seleciona-se a
**instituição** (ex.: *Câmara Municipal*, *Prefeitura*) e o menu principal traz:
- **ENVIO** — transmitir nova remessa.
- **SUBSTITUIÇÃO** — substituir remessa enviada.
- **HISTÓRICO DAS TRANSMISSÕES** — ✅ **FONTE DE DOWNLOAD** dos pacotes/ZIPs já transmitidos (homologados). É por aqui que o scraper baixa os arquivos.
- **CALENDÁRIO** — prazos das remessas.
- **RELATÓRIOS PCA** — relatórios.
- **ATIVAR ÓRGÃO** / **SUBSÍDIO VEREADORES** — administrativos.

Passos do scraper: login → (se necessário) **selecionar instituição** → **HISTÓRICO DAS TRANSMISSÕES**
→ filtrar por módulo/competência → baixar os ZIPs da lista configurada.

> **Atenção ao formato:** os pacotes desse portal são **remessas no layout SICOM** (registros de tamanho fixo,
> conforme os manuais por módulo). É um formato **diferente** dos relatórios Excel/TXT já importados — exigirá
> **parsers de layout** dedicados (os manuais enviados definem cada registro). Maior esforço que os relatórios.

## Pré-requisitos (servidor)
- Node.js (já em uso no projeto).
- **Playwright** + navegador: `npm i -D playwright` e `npx playwright install chromium`.
- **OCR de CAPTCHA**:
  - Opção A (recomendada p/ "sem API externa"): **ddddocr** em Python (`pip install ddddocr`),
    chamado por um pequeno script Python a partir do Node (stdin/stdout).
  - Opção B: porta ONNX/JS do ddddocr, se preferir 100% Node.
- Variável de ambiente `SICOM_CRYPTO_KEY` (32 bytes, base64) para a criptografia AES das credenciais.

## Componentes a implementar (quando a lista de arquivos estiver definida)
1. **Tabela `CredencialSicom`** (Prisma): `municipio`, `usuarioCifrado`, `senhaCifrada`, `iv`, `tag`,
   `atualizadoEm`. Cifragem AES-256-GCM com `SICOM_CRYPTO_KEY`. Nunca logar valores.
2. **Script de scraping** (`scripts/sicom-fetch.ts`, Playwright + OCR) — roda no servidor (Node):
   login com retry, navegação, download dos ZIPs para uma pasta temporária.
3. **API `POST /api/importacao/sicom/auto`** — dispara o job (em background), retorna um `jobId`.
4. **Página `/importar-dados`** — status em tempo real (etapas, arquivos baixados, importados, erros).
5. **Reuso dos importadores atuais** — cada arquivo baixado passa por `dispatchImport` (detecção automática);
   o que ainda não tiver importador dedicado vai para a fila de "novo importador".

## Segurança das credenciais (resumo técnico)
- Cifrar com `crypto.createCipheriv('aes-256-gcm', key, iv)`; guardar `iv` + `authTag` + texto cifrado.
- `SICOM_CRYPTO_KEY` só no `.env` do servidor (fora do Git). Sem a chave, não há como decifrar.
- Cadastro/atualização de credencial só por perfil **Administrador**; decifragem só em memória, no momento do login.

## Tratamento de erros
- CAPTCHA errado → novo CAPTCHA + nova tentativa (máx. 5).
- Login bloqueado/instável → aborta, registra em **Auditoria** e notifica na página.
- Arquivo não encontrado/alterado → marca o item como "não localizado" e segue os demais.
- Toda execução fica registrada (data, itens, sucesso/erro) — sem expor senha.

## Agendamento (opcional)
- Rodar periodicamente (ex.: diário às 6h) via tarefa agendada do Windows ou cron, chamando a API.
- Idempotente: reimportar o mesmo arquivo não duplica (importadores já são idempotentes por origem).

## Lista de arquivos a buscar
A lista fica em **`sicom-arquivos.config.json`** (template abaixo). Preencha conforme você for me pautando.
Cada item: o **módulo**, um **rótulo**, o **padrão do nome/seção** no portal e o **importador** esperado.
