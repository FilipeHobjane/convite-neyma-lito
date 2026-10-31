# Resultados dos testes (31/10/2026)

## Automáticos: 36 de 36 aprovados em dois ambientes

Executados com `npm test` em Node 22.23.4 e, contra o motor oficial da Cloudflare, em `wrangler pages dev` 4.156.0 com D1 local.

Cobrem: páginas e cabeçalhos de segurança, 404, travessia de pastas, RSVP, actualização sem duplicar, limite de acompanhantes, prazo, campo isca, XSS, SQL injection, mensagens, concorrência nos presentes, autenticação, sessão falsa ou expirada, origem externa, validação de definições, ficheiros em blocos, Range, eliminação, importação e exportação CSV, estatísticas, permissões do token de backup, cópia e recuperação com ficheiros idênticos, restauro por API, migração Flask, actualização de bases da versão anterior, carta pessoal, capítulos, Save the Date sem dados a mais, modelos por relação, nova importação sem duplicar, registo de envio e limites de pedidos.

A actualização de uma base criada pela versão anterior também foi executada em `wrangler pages dev` com D1 local: o convidado manteve-se e a nova versão gravou capítulos.

A execução na Cloudflare encontrou um defeito que o Node não mostrava (foto eliminada ainda servida da cache), já corrigido.

## Manuais no navegador (Chromium)

| Verificação | Resultado |
|---|---|
| Envelope, abertura, todas as secções | OK a 375 px |
| Sem deslocamento horizontal | OK a 320, 375, 768 e 1024 px |
| Link pessoal, RSVP com acompanhantes, agradecimento | OK |
| Limite do contador de acompanhantes | OK |
| Galeria e ampliação | OK |
| Capa com fotografia; modo pós-casamento | OK |
| Mensagem de WhatsApp: quebras de linha, sem link pessoal | OK (conteúdo da ligação) |
| Painel: login, senha errada, estatísticas, edição, pesquisa, 15 ecrãs | OK a 375 px |
| Carregar imagem de 3000 px | OK: reduzida a 1600 px, JPEG, com miniatura |
| Cópia e restauro completos pelo painel | OK: dados iguais depois de restaurar |
| Service worker e cache sem `/api` | OK no servidor Node |
| Selo, carta, capítulos, pétalas, passe e imagem do passe | OK a 375 px; a vibração e a partilha da imagem precisam de telemóvel real |
| Painel: Carta e história, saudação e mensagem do convidado | OK a 375 px |
| Save the Date: raspar, foto, data, pétalas e contagem | OK a 375 px com gestos simulados; raspar com o dedo e abrir o ficheiro da agenda precisam de telemóvel real |
| Excel: modelo aberto no Excel 16, preenchido e guardado, depois importado com acentos e telefones em vários formatos | OK |
| Enviar: botão bloqueado sem confirmação, mensagem e número correctos, registo de abertura | OK sem abrir o WhatsApp real |
| Erros na consola | Só os 401/404 esperados dos próprios testes |
| Pacotes externos | Nenhum, logo sem vulnerabilidades de dependências |
| Ligações externas no código | Apenas wa.me e Google Maps |

## Não testado: fazer antes de enviar os convites

| Item | Motivo | Como verificar |
|---|---|---|
| **Publicação em produção** | Exige as suas contas | `PUBLICACAO.md`, passo 5 |
| **iPhone (Safari) e Android reais** | Sem dispositivos neste ambiente | Abrir, confirmar, tocar música |
| **Pré-visualização real no WhatsApp** | Só existe com endereço público | Enviar o link para si |
| **Registo do service worker na Cloudflare** | Falhou em `wrangler pages dev` e, na versão 2.2.0, também no servidor Node dentro do painel de navegador usado nos testes, com erro genérico, embora o ficheiro seja servido com estado 200. A causa não foi apurada; pode ser do ambiente local. O convite funciona sem ele, mas não fica instalável | Depois de publicar, ver em DevTools → Application |
| Instalação como aplicação | Depende do ponto anterior | Menu do navegador no telemóvel |
| Reprodução de música no navegador | Pedidos parciais testados por API, sem reprodução real | Carregar um MP3 |
| Escolher presente no ecrã | Testado por API; a caixa de confirmação do navegador não foi accionada | Escolher um presente de teste |
| Limites reais de CPU e D1 | O simulador local não os aplica | Testar galeria e música depois de publicar |
| GitHub Actions | Exige repositório | **Run workflow** uma vez |
| Migração com a sua base real | Não estava no ZIP; testada com base simulada | `MIGRACAO.md` |
