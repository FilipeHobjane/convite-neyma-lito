# Arquitectura

A justificação e a comparação de fornecedores estão em [AUDITORIA.md](AUDITORIA.md).

```
Navegador ── HTTPS ──► public/ (estático)
                  └──► src/app.js ── SQLite (D1 ou ficheiro local)
                        ▲     ▲
     functions/[[path]].js    server/local.mjs
```

## Pedidos

| Caminho | Quem responde |
|---|---|
| `/`, `/c/<código>` | `src/app.js`: junta os dados e os metadados à página `public/index.html` |
| `/api/*` | `src/app.js` |
| `/media/<id>` | `src/app.js`: fotos e música, com suporte a Range (necessário no iPhone) |
| Tudo o resto | Ficheiros de `public/` |

Na Cloudflare, `public/_routes.json` define esta divisão, e os estáticos não gastam a quota diária de pedidos.

## Base de dados

| Tabela | Conteúdo |
|---|---|
| `settings` | Textos, cores, datas, dados de pagamento (chave/valor) |
| `guests` | Convidados: código pessoal, estado (`pendente`, `sim`, `nao`), acompanhantes |
| `events` | Programa e locais |
| `messages` | Mensagens (`aprovado`, `oculto`) |
| `gallery` | Fotografias: referência ao ficheiro e à miniatura |
| `gift_categories`, `gifts`, `stores` | Presentes e lojas |
| `media`, `media_chunks` | Ficheiros em blocos de 900 KB |
| `rate_limits` | Contadores de pedidos (hash do IP, sem endereço) |

As tabelas são criadas automaticamente no primeiro pedido (`ensureSchema`). Para mudar a estrutura, altere `SCHEMA` em `src/schema.js`, aumente `SCHEMA_VERSION` e, para novas colunas, acrescente `ALTER TABLE` e actualize `BACKUP_TABLES`.

## Regras do projecto

- Sem pacotes em execução. `src/` só usa normas da Web.
- Dados do casal apenas em `settings` e tabelas; os valores iniciais estão em `src/schema.js`.
- Texto vindo da base de dados entra por `textContent`, nunca como HTML.
- Limites da Cloudflare gratuita a respeitar: 10 ms de CPU por pedido, 50 consultas por pedido, 100 parâmetros por consulta, 2 MB por linha. Por isso existem blocos, `json_each` e a cópia ficheiro a ficheiro.
