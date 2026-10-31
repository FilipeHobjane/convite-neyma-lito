# Custos, limites e riscos

Valores consultados em Outubro de 2026. Planos gratuitos podem mudar: confirme nas páginas oficiais antes de decisões importantes.

## Custos

| Item | Hoje | No futuro |
|---|---|---|
| Cloudflare Pages + D1 | 0 | Plano pago, se os limites gratuitos desaparecerem: tipicamente cerca de 5 USD/mês (confirmar o preço na altura) |
| GitHub, repositório privado | 0 | Idem |
| Endereço `pages.dev` | 0 | - |
| Domínio próprio (opcional) | - | Tipicamente 10 a 15 USD/ano num `.com`, com renovação anual obrigatória |
| Plano de saída: VPS (opcional) | - | Tipicamente alguns USD/mês |

## Limites gratuitos e o que significam

| Limite | Valor | Estimativa para 300 convidados |
|---|---|---|
| Pedidos dinâmicos | 100 000/dia | Muito acima do esperado; ver abaixo |
| Escritas D1 | 100 000 linhas/dia | Muito acima do esperado |
| Leituras D1 | 5 milhões de linhas/dia | Muito acima do esperado |
| Tamanho da base | 500 MB (a aplicação pára aos 450 MB) | Centenas de fotos reduzidas |
| CPU | 10 ms por pedido | O maior risco técnico: ver abaixo |

Cada abertura do convite usa um pedido dinâmico mais um por fotografia não guardada em cache. Ao atingir um limite, o convite falha até ao reinício diário, à meia-noite UTC. Os dados não se perdem.

## Riscos que permanecem

| Risco | Impacto | Mitigação |
|---|---|---|
| **Publicação real não testada** | Algo pode comportar-se de forma diferente na nuvem | Testes corridos no motor oficial localmente; seguir a verificação em `PUBLICACAO.md` antes de enviar convites |
| Limite de 10 ms de CPU e limites reais de D1 | O simulador local não os aplica. Ficheiros grandes ou páginas com muitos dados podem dar erro | Blocos de 900 KB e redução de imagens; testar música e galeria após publicar |
| Alteração dos planos da Cloudflare | Possível custo ou indisponibilidade | Cópias fora da plataforma; servidor local pronto |
| Conta Cloudflare ou GitHub perdida | Site em baixo | Cópia local do código e dos dados; activar autenticação em dois passos |
| Cópias não verificadas | Falsa segurança | Praticar a recuperação uma vez |
| Link pessoal partilhado | Terceiros vêem e alteram a resposta desse convidado | Não há login de convidado, de propósito; aviso no guia |
| Dados de pagamento públicos | NIB e números visíveis a quem abrir o link, como no original | Remover no painel os que não quiser publicar |
| Foto eliminada | Pode ficar em cache noutro centro de dados até 1 dia, e no navegador de quem já a viu | Limite inerente às caches |
| Senha única no painel | Sem perfis múltiplos nem 2FA. A senha mudada no painel usa HMAC rápido com chave secreta, por causa do limite de CPU: exige 12 caracteres ou mais | Senha longa e limite de tentativas; o Cloudflare Access gratuito pode acrescentar autenticação |
| Limite por IP e redes móveis | Muitos convidados na mesma operadora podem partilhar IP e atingir 15 confirmações/hora | Se acontecer, aumente `LIMITS.rsvp` em `src/app.js` |
| Telemóveis muito antigos | Navegadores anteriores a 2020 podem falhar | Alternativas CSS incluídas; a confirmação pode ser feita manualmente no painel |
| `node:sqlite` experimental | Afecta só o modo local | Fixar uma versão do Node em servidor próprio |
