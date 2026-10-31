# Auditoria do projecto original e decisão de arquitectura

Data: 31 de Outubro de 2026. Originais preservados em `_originais/` (com `SHA256.txt`).

## 1. Os dois ficheiros

| Ficheiro | Conteúdo |
|---|---|
| `CLAUDE.md` | Notas técnicas do projecto, com 8 itens por fazer e 14 bugs conhecidos. É byte a byte igual ao `CLAUDE.md` dentro do ZIP (mesmo SHA-256). |
| `convite_casamento_claude_code.zip` | Aplicação Flask + SQLite. **Não contém `database.db` nem fotos**: os dados reais (RSVPs, fotos, senha alterada) estão na instância do utilizador. |

## 2. Diagnóstico técnico

- **Linguagens:** Python 3, Jinja2, JavaScript puro, CSS, SQL.
- **Bibliotecas:** Flask 3.0, Werkzeug, Pillow, pyngrok, gunicorn; Bootstrap 5 e Font Awesome (CDN, só no admin); Google Fonts (CDN).
- **Arquitectura:** monolito (`app.py`, 1072 linhas) que desenha as páginas no servidor.
- **Base de dados:** SQLite, tabelas `settings, users, events, rsvps, messages, gallery, gift_categories, gifts, stores`.
- **Autenticação:** sessão Flask com um utilizador; senha com hash; senha inicial `admin123` no código.
- **Armazenamento:** ficheiros em `static/`, que se perdem em alojamento efémero.
- **Publicação:** Render (`render.yaml`) ou túnel a partir do próprio computador (ngrok/cloudflared).

## 3. Diagnóstico funcional

| Elemento | Situação actual | Problema identificado | Melhoria recomendada |
|---|---|---|---|
| Alojamento | Render gratuito ou túnel | Render gratuito apaga BD e fotos ao adormecer ou reiniciar; o túnel exige o PC ligado e o link muda | Cloudflare Pages + D1 |
| RSVP | Formulário anónimo; insere sempre uma linha nova | Duplicados, sem actualização, sem prazo aplicado | Lista de convidados com link individual e actualização |
| Convidados | Só existem depois de responder | Impossível saber quem ainda não respondeu | Tabela `guests` com estado pendente/sim/não |
| Acompanhantes | Inexistente | Convite fixo "válido para 1 pessoa" | Limite por convidado, validado no servidor |
| Exportação | CSV sem BOM | Acentos errados no Excel; risco de injecção de fórmulas | CSV com BOM e células neutralizadas |
| Backup | Inexistente | Perda total possível | Exportação e restauro no painel, script e automatização |
| Segurança admin | Acções destrutivas por GET, sem CSRF, sem limite de tentativas, chave de sessão por defeito | Um link malicioso pode apagar dados; força bruta possível | POST + Origin + SameSite, limites, segredos fora do código |
| Spam | Nenhuma protecção | Enchimento automático de RSVPs e mensagens | Limite por IP + campo isca + validação de tamanho |
| Corrida nos presentes | SELECT seguido de UPDATE | Dois convidados podem reservar o mesmo presente | UPDATE atómico |
| `settings/update` | Grava qualquer chave recebida | Chaves arbitrárias; `redirect_to` aberto | Lista branca de chaves; sem redireccionamento livre |
| Tema | Cores e fontes copiadas sem validação para `<style>` | Injecção de CSS | Validação de cor e lista fechada de fontes |
| Data | Mostrada em ISO (`2026-10-17`) | Pouco elegante | Data por extenso |
| Fuso horário | Contagem usa a hora do dispositivo | Errada para quem está fora de Moçambique | Hora fixa em +02:00 |
| WhatsApp | Quebras de linha `%250A`; `og:image` relativa e sem domínio | Mensagem partida, sem pré-visualização | Mensagem correcta e metadados absolutos |
| Menu público | Inexistente | Página longa sem navegação | Navegação compacta para telemóvel |
| Admin móvel | Barra lateral fixa de 230 px | Inutilizável no telemóvel | Painel responsivo |
| Imagens | Sem lazy loading, galeria 1920 px, `alianca.png` e favicon em falta | Lento em dados móveis, erros 404 | Redução no navegador, miniaturas, lazy loading, ícones |
| Dependências externas | CDN e Google Fonts | Falham se o CDN mudar; privacidade | Tudo alojado no projecto |
| Bugs do `CLAUDE.md` | 14 conhecidos, 8 por fazer | Ver `CHANGELOG.md` | Corrigidos ou tornados obsoletos pela nova versão |

### Inconsistências nos dados (não alteradas: cabe ao casal decidir)

1. **A data do casamento, 17/10/2026, e o prazo de RSVP, 20/09/2026, já passaram** à data desta auditoria.
2. O Manual diz "A cerimónia começa às 10h00", mas a hora do casamento e o programa dizem 11h00.
3. O número E-Mola `+258 86 65 0750` tem 8 dígitos; os números móveis moçambicanos têm 9.
4. O titular E-Mola é "Nelde Checo", mas o nome da noiva é "Nelde Alberto Fumo".
5. O M-Pesa é `+258 84 4747730`, mas o exemplo de WhatsApp no admin antigo era `258847474730`: os dígitos não coincidem (`844747730` e `847474730`). Pode ser apenas um exemplo.

## 4. Sustentabilidade: dependências do original

| Dependência | Risco | Tratamento |
|---|---|---|
| Render gratuito | Dados efémeros, disco só em planos pagos | Removido |
| ngrok / cloudflared | Link instável, PC ligado | Removido |
| Google Fonts, jsDelivr, cdnjs | Alteração ou indisponibilidade | Removidos; fontes dentro do projecto |
| Pillow, Flask | Baixo | Substituídos por uma aplicação sem dependências |
| Google Maps | Apenas ligações, sem API nem chave | Mantido; se falhar, o endereço continua visível |
| wa.me | Apenas ligação | Mantido |

## 5. Comparação de alojamento (consultado em Out/2026)

Pontuação qualitativa face aos critérios pedidos. Os limites mudam: confirmar nas páginas oficiais.

| Opção | Custo / limites gratuitos | Dados persistentes | Riscos | Veredicto |
|---|---|---|---|---|
| **Cloudflare Pages + D1** | Estáticos sem limite de pedidos; 100 000 pedidos dinâmicos/dia; D1 até 500 MB por base, 5 M leituras e 100 k escritas/dia | Sim | 10 ms de CPU por pedido; APIs próprias (mitigado com adaptador) | **Escolhida** |
| GitHub Pages | 1 GB, 100 GB/mês; só estático; desaconselhado para transacções sensíveis | Não | Precisa de outro serviço para RSVP | Boa só como cópia estática |
| Netlify | 300 créditos/mês partilhados desde Abril de 2026 | Não incluídos | Fontes de terceiros indicam pausa ao esgotar créditos | Rejeitada |
| Firebase Hosting + Firestore | Quotas diárias reduzidas | Sim | NoSQL proprietário, migração difícil | Rejeitada |
| Supabase | 2 projectos; Postgres | Sim | Fontes de terceiros indicam pausa após 7 dias sem actividade: mau para um convite | Rejeitada |
| Render gratuito | Adormece aos 15 min | **Não**: ficheiros efémeros, sem disco no gratuito | Perda de dados | Rejeitada |
| PythonAnywhere gratuito | 512 MB, 1 app, subdomínio | Sim | Expira após 1 mês sem renovação manual; sem domínio próprio nem tarefas agendadas | Plano B |
| SQLite em VPS ou PC próprio | Custo da máquina | Sim | Manutenção própria | **Plano de saída** (já suportado) |

### Cloudflare vs GitHub

| Critério | Cloudflare Pages | GitHub Pages |
|---|---|---|
| Publicação por Git | Sim, com repositório privado | Sim; repositório privado exige plano pago |
| Domínio próprio e HTTPS | Sim, automático | Sim, automático |
| Código no servidor | Sim (Functions) | Não |
| Base de dados | D1 integrada | Nenhuma |
| Migração | Ficheiros estáticos e dump SQL | Ficheiros estáticos |

### Endereço

- **Gratuito:** `nelde-nilton.pages.dev` (se o nome estiver livre), com HTTPS incluído.
- **Próprio (opcional):** um `.com` custa tipicamente cerca de 10 a 15 USD/ano, pagos ao registador. Um domínio `.co.mz` tem preço definido pelos registadores locais. HTTPS continua gratuito. Ver `docs/PUBLICACAO.md`.

## 6. Arquitectura escolhida

```
Convidado / Admin (navegador)
        │ HTTPS
 ┌──────▼───────────────────────────────┐
 │ Camada 1: public/  HTML, CSS, JS      │  ficheiros estáticos em qualquer alojamento
 ├──────────────────────────────────────┤
 │ Camada 2: src/app.js (fetch padrão)   │  mesmo código nos dois adaptadores:
 │   • functions/[[path]].js  Cloudflare │
 │   • server/local.mjs       Node       │
 ├──────────────────────────────────────┤
 │ Camada 3: SQLite                      │  D1 na nuvem, ficheiro .db local
 ├──────────────────────────────────────┤
 │ Camada 4: cópias fora da plataforma   │  painel, scripts/backup.mjs, GitHub Actions
 └──────────────────────────────────────┘
```

**Porquê um só código JavaScript, em vez de manter Flask?** O alojamento gratuito fiável e sem expiração executa JavaScript, não Flask. Manter dois backends (Python e JavaScript) duplicaria toda a lógica. O código usa apenas `Request`/`Response`, normas da Web, sem pacotes. O Node.js, gratuito, só é preciso para correr localmente e fazer backups por script.

Esta decisão contraria a nota antiga "Sem React/Node" do `CLAUDE.md`, porque a persistência gratuita tem prioridade neste pedido. Quem preferir Python tem a aplicação Flask original em `_originais/`, e os dados podem ser movidos porque a base é SQLite.

**Fotos e música na própria base de dados**, divididas em blocos de 900 KB (limite de 2 MB por linha no D1). A cópia de segurança fica assim num único ficheiro, e evita-se o R2, que precisa de cartão de pagamento segundo a informação disponível à data.

**Senha do administrador fora da base de dados**, como variável secreta. O limite de 10 ms de CPU torna arriscado usar hash lento em cada login; uma senha longa aleatória, com limite de tentativas, é a alternativa segura. A desvantagem é que mudá-la se faz no painel da Cloudflare e não no convite.

## Fontes

- [Limites D1](https://developers.cloudflare.com/d1/platform/limits/), [preços D1](https://developers.cloudflare.com/d1/platform/pricing/)
- [Limites Workers](https://developers.cloudflare.com/workers/platform/limits/), [limites Pages](https://developers.cloudflare.com/pages/platform/limits/)
- [Limites GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Render gratuito](https://render.com/docs/free)
- [PythonAnywhere: alterações 2026](https://blog.pythonanywhere.com/221/), [preços](https://www.pythonanywhere.com/pricing/)
- [Créditos Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Comparação Supabase (terceiros)](https://neon.com/guides/neon-vs-supabase-free-plan)
