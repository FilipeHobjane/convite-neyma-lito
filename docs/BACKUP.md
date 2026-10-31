# Cópias de segurança

O código no Git **não** contém os dados. Convidados, mensagens, fotos e música existem apenas na base de dados, por isso precisam destas cópias.

Cada cópia é um único ficheiro `.json` com tudo. Contém dados pessoais e links dos convidados: guarde-a num local privado, como um disco externo ou uma pasta pessoal na nuvem. Se a enviar por email ou a partilhar, cifre-a primeiro.

## Três formas

### 1. No painel (manual)

**Cópias de segurança → Descarregar cópia completa.**

### 2. Script no seu computador

```bash
set BACKUP_TOKEN=o-seu-token
```

```bash
node --no-warnings scripts/backup.mjs https://nome.pages.dev backups
```

Mantém as 30 cópias mais recentes (ajustável com `BACKUP_KEEP`). No Windows, pode agendar este comando com o **Agendador de Tarefas**.

### 3. Automática no GitHub (diária)

O ficheiro `.github/workflows/backup.yml` já está pronto. **O repositório tem de ser privado.**

1. Em **Settings → Secrets and variables → Actions**, crie `SITE_URL` (ex.: `https://nome.pages.dev`) e `BACKUP_TOKEN`.
2. Em **Actions → Cópia de segurança → Run workflow**, execute uma vez e confirme que termina bem.
3. As cópias ficam em cada execução, como **artifact**, durante 30 dias.

O GitHub pode desactivar tarefas agendadas após 60 dias sem actividade no repositório. Descarregue também uma cópia de vez em quando.

## Frequência recomendada

| Período | Frequência |
|---|---|
| Durante as confirmações | Automática diária |
| Antes de cada alteração grande ou restauro | Manual |
| Depois do casamento | Uma cópia final, guardada em dois locais |

Uma cópia só tem valor se puder ser restaurada: pratique uma vez, com [RECUPERACAO.md](RECUPERACAO.md).
