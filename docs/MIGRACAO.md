# Migração

## Da versão Flask antiga (a sua instância actual)

O ZIP analisado não trazia a base de dados real. Na pasta onde a versão antiga corre existe `database.db`.

1. Pare a aplicação antiga e copie a pasta inteira para um local seguro.
2. Crie o ficheiro de migração; a pasta antiga é só lida:

```bash
node --no-warnings scripts/import-flask.mjs "C:\caminho\convite_casamento" migracao.json
```

3. No painel novo: **Cópias de segurança → Escolher ficheiro de cópia → `migracao.json`**.
4. Confirme convidados, mensagens, fotografias e presentes.

O que muda: os RSVPs passam a convidados "via link geral", e o tema antigo é substituído pelo novo (pode ser ajustado em **Aparência**). A senha antiga não é importada.

Se o alojamento antigo era Render gratuito, os dados podem já ter sido apagados: verifique primeiro.

## Para um servidor próprio (VPS ou computador sempre ligado)

Requisitos: Node.js 22.5 ou superior e um proxy com HTTPS.

1. Copie o projecto, crie `.env` com `HOST=127.0.0.1` e `TRUST_PROXY=1`.
2. Restaure a última cópia com `scripts/restore.mjs`.
3. Inicie `npm start` como serviço (systemd, pm2 ou similar).
4. Configure o Caddy, que obtém o HTTPS automaticamente:

```
convite.exemplo.com {
    reverse_proxy 127.0.0.1:8788
}
```

5. Mude o DNS do domínio. O link `pages.dev` antigo não pode ser redireccionado depois de o projecto ser apagado, por isso um domínio próprio facilita mudanças futuras.

## Para outro alojamento com Web padrão

`src/app.js` recebe `Request` e devolve `Response`, por isso outras plataformas precisam apenas de um pequeno adaptador, como `functions/[[path]].js`, e de uma base com a interface `prepare/bind/first/all/run/batch`. Veja `server/local.mjs` como exemplo.

Para bases não-SQLite, os dados podem ser lidos do JSON da cópia. As consultas usam `json_each`, `RETURNING` e `ON CONFLICT`, que teriam de ser adaptadas.

## Só a parte visual

`public/` são ficheiros estáticos, mas o convite precisa da API para receber os dados. Sem backend, serve apenas uma adaptação estática: não é uma alternativa imediata.

## Exportar da Cloudflare sem painel

```bash
npx wrangler d1 export convite --remote --output=convite.sql
```

Depois, numa base SQLite local:

```bash
sqlite3 data/convite.db < convite.sql
```
