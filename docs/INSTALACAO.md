# Instalação e configuração

## 1. Instalar o Node.js

Descarregue a versão LTS em https://nodejs.org ou, no Windows, execute:

```bash
winget install OpenJS.NodeJS.LTS
```

Feche e reabra o terminal e confirme que a versão é 22.5 ou superior:

```bash
node --version
```

## 2. Configurar

Copie `.env.example` para `.env`. Para gerar valores aleatórios, execute este comando duas vezes:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

| Variável | Para que serve | Obrigatória |
|---|---|---|
| `ADMIN_PASSWORD` | Senha do painel, mínimo 12 caracteres | Sim |
| `SESSION_SECRET` | Assina as sessões | Sim |
| `BACKUP_TOKEN` | Cópias automáticas, mínimo 24 caracteres | Só para cópias por script |
| `PORT`, `HOST`, `DB_PATH` | Porta, endereço e ficheiro de dados locais | Não |
| `TRUST_PROXY` | `1` atrás de nginx ou Caddy | Não |

O `.env` nunca vai para o Git.

## 3. Executar

```bash
npm start
```

A base `data/convite.db` é criada automaticamente com os dados iniciais.

## 4. Testar

```bash
npm test
```

Os testes usam uma base temporária e não tocam nos seus dados.

## Problemas comuns

| Mensagem | Solução |
|---|---|
| `node` não é reconhecido | Reabra o terminal ou reinstale o Node.js |
| `Cannot find module 'node:sqlite'` | Actualize o Node.js para 22.5 ou superior |
| "Painel por configurar" | Preencha `ADMIN_PASSWORD` e `SESSION_SECRET` no `.env` e reinicie |
| Porta ocupada | Mude `PORT` no `.env` |
