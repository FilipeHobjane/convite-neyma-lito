# Recuperação

## Restaurar para o site publicado

1. Se o site ainda tiver dados, descarregue primeiro uma cópia do estado actual.
2. **Cópias de segurança → Escolher ficheiro de cópia**.
3. Escreva `RESTAURAR` quando for pedido.
4. Aguarde o aviso "Restauro concluído" e confirme convidados e fotografias.

O restauro envia primeiro as fotos, os vídeos e a música e só no fim troca todos os dados, numa única operação. Se for interrompido ou falhar, os dados do site ficam como estavam: basta repeti-lo. A senha mudada no painel não faz parte da cópia; depois de restaurar numa base nova, entre com `ADMIN_PASSWORD`. Cópias muito grandes (mais de cerca de 1,8 MB só de dados, sem contar ficheiros) têm de ser restauradas no computador, como abaixo.

## Restaurar no computador (o alojamento desapareceu)

Com o Node.js instalado e `.env` preenchido:

```bash
node --no-warnings scripts/restore.mjs caminho/convite-backup.json data/convite.db
```

```bash
npm start
```

O convite volta a funcionar localmente, com todos os dados.

## Perdi o código

Clone o repositório do GitHub ou use uma cópia desta pasta. Se perdeu o código e o GitHub, os dados na cópia `.json` continuam legíveis: é JSON com as tabelas e os ficheiros em Base64.

## Perdi a senha

Altere `SESSION_SECRET` e defina `ADMIN_PASSWORD` com a senha que quiser: na Cloudflare, nos segredos do projecto, publicando novamente; no computador, no ficheiro `.env`, reiniciando depois. A senha mudada no painel deixa de valer e entra com `ADMIN_PASSWORD`. Nenhum dado se perde.

## Situações

| Situação | O que fazer |
|---|---|
| Apaguei um convidado por engano | Restaure no computador para uma base à parte e copie os dados, ou restaure a última cópia no site, aceitando perder o que veio depois dela |
| Cópia automática a falhar | Ver o erro em **Actions** no GitHub. Normalmente `BACKUP_TOKEN` ou `SITE_URL` não coincidem |
| Limite diário atingido | O serviço volta depois da meia-noite UTC. Ver [CUSTOS_E_RISCOS.md](CUSTOS_E_RISCOS.md) |
