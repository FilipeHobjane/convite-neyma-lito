# Registo de alterações

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
