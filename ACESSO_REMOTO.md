# Acesso remoto (link compartilhável) — GesIA

> Link **temporário** servido do seu PC via túnel (sem cadastro). Funciona **enquanto**:
> 1. o computador estiver **ligado**, 2. o **servidor** (npm start) rodando, 3. o **túnel** rodando.
> Se qualquer um parar, o link cai. A URL **muda** a cada reinício do túnel.

## Links atuais (Cloudflare)
- **Teaser (PÚBLICO, sem senha) — para divulgar:**
  https://tex-atmosphere-chrome-combo.trycloudflare.com/teaser.html
- **Sistema (com senha):** https://tex-atmosphere-chrome-combo.trycloudflare.com
- **Senha do sistema:** usuário = qualquer · senha = `FrancaDias@2026` (variável `GESIA_ACESSO_SENHA` no `.env`)
- O teaser tem botão "Acessar o sistema" que leva ao login. Rota `/teaser*` é liberada no middleware.
- **Atenção:** a URL do Cloudflare grátis **muda** a cada reinício do cloudflared. Se cair, rode e me peça a nova:
  `npx --yes cloudflared tunnel --url http://localhost:3003`  (a URL nova aparece no log)

### Fallback localtunnel (instável; tem o passo do IP)
`npx --yes localtunnel --port 3003 --subdomain gesiafd` → https://gesiafd.loca.lt (IP `45.180.189.219`)

> Cloudflare Quick Tunnel tentado, mas o serviço grátis (account-less) estava retornando erro 1101
> (500) no momento — instabilidade do lado da Cloudflare. Reverter para Cloudflare quando normalizar:
> `npx --yes cloudflared tunnel --url http://localhost:3003`

## ⚠️ Importante
- Há **dados financeiros reais**. A senha reduz a exposição, mas é internet pública — **não divulgue o link abertamente**. Atenção à **LGPD** (evite carregar a folha, que tem dados pessoais, enquanto exposto).
- Troque a senha quando quiser em `.env` (`GESIA_ACESSO_SENHA`) e reinicie o servidor.

## Como religar (se cair)
```powershell
# 1) servidor (produção)
cd "C:\OneDrive\39 - Aplicações Desenvolvimento\Sistemas IA Novos\franca-dias-gestIA"
npm run build ; npm run start    # porta 3003

# 2) túnel (nova URL será gerada)
npx --yes localtunnel --port 3003
```

## Alternativa com link mais limpo (sem o aviso de IP)
Cloudflare Quick Tunnel (sem conta, sem interstício):
```powershell
# baixar o cloudflared uma vez e rodar:
npx --yes cloudflared tunnel --url http://localhost:3003
```
Gera uma URL `https://...trycloudflare.com` direta (só a senha do sistema). Posso configurar isso se preferir.
