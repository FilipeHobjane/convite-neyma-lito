# Convite de Casamento Digital

Convite elegante para telemóvel com confirmação de presença, lista de convidados, painel de administração e cópias de segurança. Funciona sem mensalidades e sem pacotes externos.

## Experimentar no computador

1. Instale o [Node.js LTS](https://nodejs.org) (versão 22.5 ou superior).
2. No Windows, faça duplo clique em `iniciar.bat`: cria a configuração, mostra a senha inicial e abre o painel.

Noutros sistemas, execute `node scripts/setup.mjs` e depois `npm start`.

- Convite: http://127.0.0.1:8788/
- Painel: http://127.0.0.1:8788/admin/

## Guias

| Preciso de… | Guia |
|---|---|
| Instalar e configurar | [docs/INSTALACAO.md](docs/INSTALACAO.md) |
| Colocar na internet | [docs/PUBLICACAO.md](docs/PUBLICACAO.md) |
| Usar o painel, gerir convidados | [docs/ADMINISTRACAO.md](docs/ADMINISTRACAO.md) |
| Fazer cópias de segurança | [docs/BACKUP.md](docs/BACKUP.md) |
| Recuperar dados | [docs/RECUPERACAO.md](docs/RECUPERACAO.md) |
| Mudar de fornecedor; importar a versão Flask | [docs/MIGRACAO.md](docs/MIGRACAO.md) |
| Manter e actualizar | [docs/MANUTENCAO.md](docs/MANUTENCAO.md) |
| Perceber a arquitectura | [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) |
| Ver custos, limites e riscos | [docs/CUSTOS_E_RISCOS.md](docs/CUSTOS_E_RISCOS.md) |
| Ver resultados dos testes | [docs/TESTES.md](docs/TESTES.md) |
| Ver a auditoria inicial | [docs/AUDITORIA.md](docs/AUDITORIA.md) |
| Ver o registo de alterações | [CHANGELOG.md](CHANGELOG.md) |

## Estrutura

```
public/        Páginas, estilos, scripts, fontes e ícones (camada visual)
src/           Lógica da aplicação: app.js, http.js, schema.js
functions/     Ligação à Cloudflare Pages
server/        Servidor para computador ou VPS
scripts/       Cópia, restauro e importação da versão Flask
tests/         Testes automáticos
docs/          Documentação
_originais/    Ficheiros originais intocados (fora do Git)
```

## Dependências

Nenhuma biblioteca é necessária em execução: `package.json` não lista pacotes. O Node.js só é preciso para correr no computador ou num servidor próprio e para os scripts. As fontes estão em `public/fonts` (licença SIL Open Font License).
