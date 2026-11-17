# Registo de alterações

## 2.12.0

- Painel → Aparência: modo do vidro (escuro ou claro), nível do fosco de 1 a 5 (ou sem fosco) e transparência do vidro sobre o fundo de 1 a 5. Substituem o regulador de 0 a 40.
- Modo claro: fundo marfim, letras verde-sálvia, vidro branco leitoso, selo verde.

## 2.11.1

- Sem fotografia carregada, o convite e o envelope mostram um fundo de luzes e linhas finas em champanhe, para que o nível de vidro fosco escolhido no painel se veja logo.

## 2.11.0 (17/11/2026)

- Save the Date: sem sino, sem rosas e sem portas da igreja. Ao aceitar, a "Fotografia da união" (nova no painel) surge partida em duas metades que se juntam em câmara lenta; uma luz sela o rasgo, a cor volta e abre-se o convite.
- Paleta verde-sálvia escuro, champanhe e marfim; nomes e títulos em Cormorant Garamond.

## 2.10.0 (17/11/2026)

- Estilo "Floresta" do convite completo: a mesma linguagem do Save the Date (fundo verde-floresta, letra Jost fina, botões e linhas caramelo, fotografias com moldura creme). As cores vêm de "Cores do Save the Date". Escolha em Aparência → Estilo do convite; "Clássico" mantém o desenho anterior.

## 2.9.0 (17/11/2026)

- Painel "virgem": os valores iniciais deixam de ter um casal de exemplo. Passam a ser genéricos (Noiva, Noivo, Pai da noiva, Local da cerimónia religiosa, Local da recepção, Nome da loja) e os dados de pagamento ficam vazios.
- Bases já existentes: os exemplos antigos que nunca foram editados são trocados pelos genéricos ao actualizar (versão 8 da base). O que já foi preenchido no painel fica intacto.
- Cada campo do painel tem uma indicação do que preencher, com exemplo.
- Painel com as cores do convite (verde-floresta, creme, caramelo e chocolate) e ícone próprio: coração com flecha de cupido, em preto e branco ao estilo yin-yang.

## 2.8.0 (17/11/2026)

- Save the Date "porta": até três fotografias com moldura, vídeo e o botão "Aceito reservar este dia". Ao tocar, uma grinalda de rosas esmeralda e chocolate floresce à volta do botão, toca o sino e abrem-se as portas de uma igreja, que levam ao convite. Substitui a raspadinha dourada.
- O convite só abre depois de aceitar (opção "std_gate" no painel). A hora da aceitação fica registada no convidado e aparece na lista; no link geral, fica guardada no telemóvel.
- Som do sino: gravação carregada no painel, ou um repique gerado no telemóvel quando não há gravação.
- Cores próprias do Save the Date no painel. Novos valores iniciais: verde-floresta, creme e caramelo, também no convite.
- Textos das mensagens do WhatsApp sem referência a raspar.

## 2.7.2 (11/11/2026)

- Importação do Excel: o painel lê a folha "Exportar para Admin" quando existe, para importar directamente a planilha de convidados (pasta `planilha/`, fora do Git).

## 2.7.1 (11/11/2026)

- Save the Date com vídeo: abre com um selo "Toque no selo para abrir". Esse toque simples desbloqueia o som no iPhone, que não aceita o gesto de raspar para isso. O vídeo carrega e corre sem som por baixo do dourado e, na revelação, recomeça do início com música, sem mais toques.

## 2.7.0 (09/11/2026)

- Save the Date: conta até à hora do casamento, como o convite. Opção no painel para mostrar "Abrir o convite" depois de raspar. Depois do casamento, agradece em vez de convidar e esconde a agenda e a contagem. A parte revelada é anunciada aos leitores de ecrã.
- Convite depois do casamento: sem "Até breve!" nem agenda no agradecimento, e a lista de presentes fica encerrada.
- Cores do dress code também reconhecidas com nomes em português.
- Painel: progresso em percentagem ao carregar o vídeo, envio incompleto apagado, e confirmação antes de remover imagens, retirar o vídeo, desmarcar um envio ou eliminar um convidado.
- Textos iniciais em português de Moçambique (para novos convites).

## 2.6.0 (09/11/2026)

- Importação: pessoas com o mesmo telefone e primeiros nomes diferentes (por exemplo, um casal) ficam como convidados separados, com aviso na pré-visualização. Telefones em notação científica do Excel são convertidos. Acompanhantes em branco mantêm o valor anterior.
- Restauro de cópias de uma só vez: os ficheiros são enviados primeiro e os dados trocados numa única transacção. Se falhar, nada muda. As cópias são validadas como dados do painel (tipos de ficheiro, definições).
- Definições em falta, por exemplo depois de restaurar uma cópia antiga, voltam aos valores iniciais também no servidor.
- Presentes: só se escolhem com o link pessoal, em nome do convidado.
- O link pessoal deixa de mostrar o telefone completo do convidado.

## 2.5.6 (09/11/2026)

- Save the Date: o vídeo é descarregado uma única vez, em partes de no máximo dois blocos, e sem endereço até ser preciso. Se a pessoa revelar antes do fim da descarga, toca directamente da rede.
- Ficheiros: respostas parciais limitadas a dois blocos, e cortadas da cache quando o ficheiro inteiro já lá está, para não exceder o limite de CPU gratuito.
- Service worker: scripts e estilos vêm sempre da rede, para as correcções chegarem a quem já abriu o convite.
- O vídeo retoma ao voltar à página.

## 2.5.5 (09/11/2026)

- Save the Date: no iPhone, o arco ficava escuro alguns segundos depois da revelação, enquanto o vídeo descarregava. O vídeo passa a descarregar assim que a página abre, e a foto fica por cima até ele ter imagem, desvanecendo depois.

## 2.5.4 (09/11/2026)

- Save the Date: a data passa a ser revelada quando o dedo sai do ecrã, no mesmo toque em que o vídeo começa com som, como o iPhone exige. Retirado o botão ▶.
- No primeiro toque, o vídeo começa a carregar sem som por baixo do dourado, para estar pronto na revelação.

## 2.5.3 (09/11/2026)

- Save the Date: a folha dourada continua a receber o dedo até ele sair do ecrã, para o iPhone não cancelar o toque que inicia o vídeo.
- Se mesmo assim o telemóvel recusar o vídeo, aparece um botão ▶ por cima dele, que o inicia com som.

## 2.5.2 (09/11/2026)

- Save the Date: no iPhone, o vídeo ficava parado quando a data aparecia a meio do gesto de raspar. Agora começa ao levantar o dedo e, se o telemóvel recusar, em cada toque seguinte até tocar com som.

## 2.5.1 (09/11/2026)

- Save the Date: o vídeo começa com som ao revelar a data, sem botão. Se o navegador recusar, começa sem som e o som entra no toque seguinte.

## 2.5.0 (09/11/2026)

- Save the Date: vídeo opcional (MP4 ou WebM, até 30 MB) por baixo do dourado. Começa sem som, repete-se e tem botão para ligar o som; a foto serve de imagem de espera.
- Retirada a opção de mostrar a data sem raspar.

## 2.4.0 (31/10/2026)

- Save the Date: título SAVE THE DATE em maiúsculas douradas.
- Importação de ficheiros Excel (.xlsx), com modelo para descarregar e lista para confirmar. Importar de novo actualiza a mesma pessoa e mantém o link.
- Modelos por relação: frase do envelope, saudação, carta e mensagens do WhatsApp, editáveis no painel.
- **Enviar pelo WhatsApp**: rever cada pessoa, confirmar, abrir a mensagem pronta e registar. Fila para seguir para o convidado seguinte.

## 2.3.0 (31/10/2026)

- Save the Date em `/guarde-a-data`: folha dourada para raspar, foto dos noivos, pétalas, contagem e agenda.
- Link pessoal com o nome do convidado, em `/guarde-a-data/<código>`, enviado pelo botão **Save the Date** em **Convidados**.
- Secção **Save the Date** no painel para a foto, os textos e a mensagem do WhatsApp.

## 2.2.0 (31/10/2026)

- Abertura: o selo parte-se ao toque e o telemóvel vibra, nos que o permitem. Botão para saltar a abertura.
- Carta escrita no ecrã com saudação e mensagem por convidado, editáveis no painel e na importação.
- História em capítulos com foto, secção nova no painel em **Carta e história**.
- Ao confirmar: pétalas e passe com o nome do convidado, que pode ser guardado como imagem.
- Bases existentes são actualizadas automaticamente no primeiro pedido, sem perder dados.

## 2.1.0 (31/10/2026)

- Painel: nova secção para mostrar, esconder e renomear cada parte do convite, envelope e contagem.
- Painel: mudar a senha, com recuperação por `SESSION_SECRET`.
- `iniciar.bat`: abre o painel com duplo clique e cria a configuração na primeira vez.

## 2.0.0 (31/10/2026)

Reescrita a partir do projecto Flask. Originais em `_originais/`.

### Arquitectura
- Um único código JavaScript sem pacotes, a correr na Cloudflare Pages e em Node.
- Fotos e música dentro do SQLite; cópia de segurança num só ficheiro.
- Removidos Render, ngrok, Bootstrap, Font Awesome e Google Fonts como dependências.

### Convite
- Novo design: envelope com selo de lacre, capa em arco, bordô e dourado, tipografia editorial.
- Navegação fixa em baixo no telemóvel, no topo no computador.
- Links pessoais `/c/<código>` com nome do convidado e limite de acompanhantes.
- RSVP actualizável, com nomes dos acompanhantes, prazo aplicado e página de agradecimento.
- Modo pós-casamento automático. Contagem no fuso de Moçambique.
- Secção de localização gerada a partir do programa. Botão "Guardar na agenda".
- Amostras de cor no dress code. Galeria com ampliação, deslizar e carregamento diferido.
- PWA instalável, sem guardar dados dinâmicos.

### Painel
- Responsivo, sem bibliotecas externas.
- Convidados: pesquisa, filtros, edição, importação do Excel, envio por WhatsApp, indicação de possíveis duplicados.
- Estatísticas de pessoas, acompanhantes, pendentes e recusas.
- Imagens reduzidas no navegador, com substituição e remoção em todas as secções.
- Cópia e restauro completos. Aviso de data passada ou prazo terminado.

### Segurança
- Palavra-passe fora do código e da base de dados; sessões assinadas de 12 horas.
- Acções só por POST/PUT/DELETE com verificação de origem e cookie SameSite=Strict.
- Limite de pedidos por IP (guardado apenas como hash), campo isca, validação no servidor.
- Política CSP sem scripts inline; texto inserido sem HTML; CSV protegido contra fórmulas.
- Lista branca de definições, cores e fontes; ligações só http(s).
- Reserva de presente atómica; o nome de quem escolheu nunca é público.

### Bugs do `CLAUDE.md` original
Todos os 14 bugs e 8 pendências foram corrigidos ou deixaram de se aplicar, com três alterações de âmbito:
- Reordenação continua por botões, sem arrastar (bug 13).
- Exportação em CSV compatível com Excel, sem `.xlsx` (pendência 7).
- Não há pré-visualização antes do envio: a imagem aparece logo depois de carregada (pendência 6).
