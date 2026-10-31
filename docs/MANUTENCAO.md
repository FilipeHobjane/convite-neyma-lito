# Manutenção

## Rotina

| Quando | Acção |
|---|---|
| Antes de enviar convites | Publicação verificada, cópia automática a funcionar, teste num Android e num iPhone |
| Durante as confirmações | Aprovar mensagens, ver duplicados, confirmar as cópias |
| Depois do casamento | Cópia final; desactivar o link geral se quiser |
| A cada 6 a 12 meses | Confirmar que o site abre e rever os limites da Cloudflare |

## Editar sem programar

Quase tudo se altera no painel. Para editar código, use qualquer editor de texto:

| Quero mudar | Ficheiro |
|---|---|
| Aspecto do convite | `public/css/convite.css` |
| Ordem ou conteúdo das secções | `public/js/convite.js` (final do ficheiro: lista `view`) |
| Painel | `public/js/admin.js`, `public/css/admin.css` |
| Regras e validações | `src/app.js` |
| Valores iniciais de uma base nova | `src/schema.js` |

Depois de alterar: execute `npm test`, experimente com `npm start`, e faça `git add`, `git commit` e `git push`.

**PWA:** ao alterar `public/sw.js`, aumente o número em `CACHE`, para os telemóveis receberem a nova versão.

## Actualizações de segurança

O projecto não tem pacotes, por isso não há actualizações de dependências. Actualize o Node.js apenas se o usar num servidor. O `compatibility_date` em `wrangler.toml` pode ficar como está; ao mudá-lo, teste antes.

`node:sqlite` é ainda experimental no Node 22. Se uma versão futura mudar o comportamento, apenas `server/local.mjs` e os scripts são afectados, não a Cloudflare.

## Registos de erros

Na Cloudflare: **Workers & Pages → projecto → Deployments → View details → Functions**. Localmente: no terminal onde corre `npm start`.
