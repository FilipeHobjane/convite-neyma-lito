# Convite de Casamento Digital

Responder sempre em português (Moçambique). A documentação em `docs/` é a referência; este ficheiro é opcional: o projecto não depende do Claude Code.

- Stack: JavaScript sem pacotes em execução. `src/` só usa normas da Web. Cloudflare Pages + D1 em produção (`functions/`), Node 22.5+ com `node:sqlite` localmente (`server/`).
- Comandos: `npm start`, `npm test`. Com `TEST_BASE`, `TEST_PASSWORD` e `TEST_BACKUP_TOKEN`, os testes correm contra `wrangler pages dev` com base vazia. Testar sempre nos dois.
- Dados do casal só em `settings`/tabelas; valores iniciais em `src/schema.js`.
- Texto da base de dados entra por `textContent`. CSP sem scripts nem estilos inline: usar `el.style.setProperty`.
- Respeitar os limites gratuitos descritos em `docs/ARQUITECTURA.md`.
- Não usar a marca "Convites Dourados MZ" nem copiar assets do site de referência.
- Originais em `_originais/`: não alterar.
