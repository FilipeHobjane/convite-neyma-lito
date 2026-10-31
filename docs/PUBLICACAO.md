# Publicação na internet (gratuita)

Precisa de uma conta GitHub e de uma conta Cloudflare, ambas gratuitas. Os nomes dos menus podem mudar: siga o sentido de cada passo.

Esta publicação ainda não foi feita: exige as suas contas.

## 1. Enviar o código para um repositório privado

Crie um repositório **privado** no GitHub, chamado por exemplo `convite`. Depois, nesta pasta:

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Convite de casamento"
```

```bash
git remote add origin https://github.com/O-SEU-UTILIZADOR/convite.git
```

```bash
git push -u origin main
```

O `.gitignore` já exclui `.env`, dados e cópias. Antes do `commit`, confirme com `git status` que nenhum desses aparece.

## 2. Criar a base de dados

1. Na Cloudflare: **Storage & Databases → D1 → Create**. Nome: `convite`.
2. Copie o **Database ID**.
3. Em `wrangler.toml`, substitua `00000000-0000-0000-0000-000000000000` por esse valor.
4. Envie a alteração:

```bash
git add wrangler.toml
```

```bash
git commit -m "Ligar base de dados"
```

```bash
git push
```

## 3. Criar o site

1. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
2. O nome do projecto define o endereço: `nelde-nilton` dá `nelde-nilton.pages.dev`.
3. Deixe o comando de build vazio e use `public` como pasta de saída.
4. Conclua a criação.

## 4. Definir os segredos

Em **Settings → Variables and Secrets**, acrescente como **Secret**, em Production: `ADMIN_PASSWORD`, `SESSION_SECRET` e `BACKUP_TOKEN`. Volte a publicar em **Deployments → Retry deployment**.

## 5. Verificar

1. Abra `/api/health`: deve mostrar `{"ok":true}`.
2. Abra o convite e o painel em `/admin/`.
3. Corrija a data e o prazo no painel, se necessário.
4. Envie uma confirmação de teste e veja-a em **Convidados**; elimine-a depois.
5. Envie o link para si no WhatsApp e confirme a pré-visualização, num Android e num iPhone.
6. Faça a primeira cópia em **Cópias de segurança**.

## Actualizar

Cada `git push` publica automaticamente. Os dados não são afectados.

## Endereço

| Opção | Custo | Notas |
|---|---|---|
| `nome.pages.dev` | Gratuito | HTTPS incluído |
| Domínio próprio | Tipicamente 10 a 15 USD/ano num `.com` | Compre num registador; o preço de renovação pode ser diferente: confirme antes de comprar |

Para usar domínio próprio: **Custom domains → Set up a domain** no projecto e siga as instruções de DNS. O HTTPS é emitido automaticamente. O link `pages.dev` continua a funcionar.

## Alternativa sem GitHub

Depois de criar a base de dados, com Node instalado:

```bash
npx wrangler login
```

```bash
npx wrangler pages deploy public --project-name nelde-nilton
```
