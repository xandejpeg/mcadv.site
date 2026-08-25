# PROMPT PARA O CLAUDE DESIGN — Nova LP MC Advocacia

## ORDEM DE TRABALHO (ler primeiro)

Antes de escrever qualquer código, siga esta ordem de análise:

1. **Analise o projeto anexado (mcadv.site)** — é o site atual do escritório, completo: entenda a estrutura, os textos, as imagens, as cores e os componentes existentes. Esse é o conteúdo oficial de referência.
2. **Analise o prompt abaixo** — as instruções do redesign: o que fica fixo, o que muda, o que não pode existir.
3. **Analise os 2 componentes enviados em mensagens separadas** — Type Sequence (hero) e Sticker Peel (logos de clientes).
4. **Só então construa a LP nova do zero** — identidade visual nova, usando os textos, informações e imagens do projeto atual, e as empresas parceiras com o efeito sticker nos logos.

---

## TAREFA

Redesenhar a landing page do escritório **Moraes de Carvalho Advogados Associados** (advocacia empresarial/tributária, 26 anos de mercado, São Paulo — site atual: mdcadvocacia.com). Entregar HTML/CSS/JS estático, responsivo, em pt-BR.

**REGRA DE OURO — CONTEÚDO:** use ÚNICA E EXCLUSIVAMENTE as informações que já existem no site atual (listadas abaixo, seção por seção). NÃO invente texto, NÃO adicione seções de conteúdo novo, NÃO encha linguiça. O trabalho é de repaginação visual e experiência — o conteúdo já está definido. A única exceção é o bloco do produto Real Prev (seção 6 abaixo), cujo texto já está redigido aqui.

## IDENTIDADE VISUAL

- **Paleta (fixa, do site atual):** fundo escuro/grafite + dourado como cor de destaque + branco. Seções alternam claro/escuro com divisores em gradiente.
- **Tipografia:** Cormorant Garamond (títulos serifados) + Inter (corpo). Opcional: JetBrains Mono apenas para labels técnicos pequenos (stats, selo do produto).
- **Tom:** advocacia premium com autoridade técnica. Sóbrio, elegante, nunca "startup colorida".
- **Referências de polimento:** hierarquia e espaçamento de templates premium de agência (ex: template "Aries"); stats e cards numerados em estilo dark-tech. Sempre adaptados à paleta dourada — sem neon colorido.
- **Logo:** usar o logo do escritório (fornecido nos assets) inclusive como marca d'água translúcida no fundo do hero.

## ESTRUTURA DA LP (ordem exata)

### 1. Header fixo
Logo + menu (Início, Sobre Nós, Serviços, FAQ, Contato) + CTA dourado "Agende uma Consulta". Fundo com blur ao rolar. Hamburger no mobile.

### 2. Hero
- Badge: "Há 26 anos no mercado"
- H1: "Advocacia Empresarial de Excelência" — com "de Excelência" em dourado
- **O H1 deve usar o componente TYPE SEQUENCE (código enviado separadamente): efeito typewriter que digita e alterna frases. Configurar com prefixo fixo e rotação das especialidades do escritório (ex: "Direito Tributário", "Recuperação de Créditos", "Auditoria Fiscal", "Advocacia Empresarial"), cursor em dourado (#C9A227 ou o dourado exato da paleta), fonte Cormorant Garamond em vez de Inter. Portar o componente de React para vanilla JS (é um typewriter simples com fases typing/holding/deleting, cursor piscante, respeito a prefers-reduced-motion).**
- Subtítulo: "Assessoria jurídica humanizada, completamente adaptada à transformação digital. Especialistas em direito tributário, recuperação de créditos e auditoria fiscal."
- Botões: WhatsApp (https://wa.me/5511961894772) + dourado "Agende uma Consulta" (âncora #contato)
- Faixa de stats abaixo dos botões (3 itens com separadores verticais finos): **26 anos de mercado** · **10+ áreas do direito empresarial** · **Software próprio de automação fiscal**
- Fundo: logo gigante translúcido (marca d'água)

### 3. Clientes — STICKER PEEL
- Label: "Empresas que confiam em nosso trabalho"
- 7 logos de clientes (fornecidos nos assets): B3, Banco Original, TNT Logística, Appa Facilities, Zambo Advogados, 3Com, Brazanitas
- **Cada logo deve ser um sticker interativo com efeito peel (descola no hover, descola mais ao pressionar), usando o componente STICKER PEEL (código enviado separadamente).**
- O componente original é React + Three.js + Framer Motion. **Portar para vanilla JS + Three.js** para manter a LP estática. O núcleo é Three.js puro: Scene, PerspectiveCamera, BoxGeometry + SkinnedMesh com grid de bones 30×30, deformação de curl semicircular guiada pela posição de fold, sombra projetada com ShadowMaterial + DirectionalLight. A camada React é apenas wrapper de eventos de pointer e animação do valor de peel.
- Parâmetros: hoverPeel 45%, pressPeel 64%, curlRotation 240°, tween 0.6s easeInOut, sombra suave (opacity ~30%), backColor em grafite/dourado escuro combinando com a paleta
- Layout: faixa horizontal ou grid com os 7 stickers (sem carrossel — o interesse visual vem do peel)
- Fallback sem WebGL: logos estáticos com hover simples

### 4. Sobre Nós
- Badge de seção "Sobre Nós" + título "Excelência em Assessoria Empresarial e Advocacia" (dourado no destaque)
- Texto atual do site: escritório com visão global, especializado em mais de 10 áreas do direito empresarial; equipe de profissionais e parceiros especializados; assessoria completa otimizada por tecnologia
- 3 bullets com check: Auditoria Fiscal de Obrigações Acessórias · Advocacia Tributária: Recuperação de Créditos · Sistemas de Automação para Coleta de Dados Fiscais
- Badge flutuante sobre a imagem: "26 — Anos de Excelência"
- Imagem: composição visual premium com o logo sobreposto (não usar foto genérica de aperto de mãos)
- CTA "Fale Conosco"

### 5. Diferenciais
- 3 cards numerados 01/02/03 com borda/glow sutil dourado, o do meio destacado:
  - 01 Auditoria Fiscal Especializada
  - 02 Recuperação de Créditos (destaque)
  - 03 Automação Inteligente
- Textos: exatamente os do site atual

### 6. Tecnologia própria — Real Prev (bloco compacto, prova técnica)
Bloco curto entre Diferenciais e Serviços. Deve parecer um selo de engenharia, não uma página de vendas. Texto a usar:

> **Tecnologia própria**
> O escritório desenvolveu o **Real Prev**, sistema que gerencia o fluxo completo do e-Social Trabalhista (S-2500 → S-2501): enquadramento previdenciário via CNAE/SERPRO, cálculo de contribuições e geração automática de XML validada.
Slogan: De 6 horas por processo a 3 cliques no eSocial Trabalhista.
Descrição completa com foco em S-2500/S-2501, dados do processo, CNPJ, CPF, SERPRO, cálculo previdenciário, XML e redução de trabalho manual.

CTA discreto: "Solicitar demonstração" (WhatsApp). Função: provar que o escritório não só advoga — constrói software fiscal.

### 7. Serviços / Áreas de Atuação
6 cards com ícone, título, descrição curta e link "Saiba mais →" (âncora #contato) — textos exatos do site atual: Auditoria Fiscal, Recuperação de Créditos (card destaque), Automação Fiscal, Softwares Contábeis (integração e-Social), Consultoria Empresarial, Planejamento Tributário.

### 8. FAQ
As 5 perguntas/respostas atuais do site em accordion + card lateral "Ainda tem dúvida? Fale conosco" com CTA.

### 9. Contato (FIXO — não mudar conteúdo nem funcionalidade)
- Faria Lima Offices — Rua Cardeal Arcoverde, 2365, Pinheiros, São Paulo/SP, 05408-003
- contato@mcap.com.br · +55 (11) 96189-4772
- Formulário funcional: nome, email, assunto, mensagem
- Botão grande WhatsApp

### 10. Localização (FIXO — não mudar)
- Foto do escritório como fundo com overlay gradiente escuro
- Card de endereço com logo pequeno
- Botões "Como Chegar" (link Google Maps) e "Agendar Visita" (WhatsApp)
- Google Maps embedado (iframe)

### 11. Footer
Logo, descrição ("Assessoria empresarial de excelência há 26 anos, exercendo advocacia humanizada e adaptada à transformação digital."), LinkedIn (linkedin.com/company/moraes-de-carvalho-advogados-associados), links rápidos, contato, formulário de newsletter, copyright.

### 12. Elementos flutuantes (FIXOS)
Botão WhatsApp flutuante com tooltip "Fale Conosco" + botão voltar ao topo.

## O QUE NÃO FAZER
- Não criar seções de pricing, blog, portfolio, ferramentas, comparativo com concorrentes ou depoimentos inventados
- Não usar conteúdo placeholder (lorem ipsum, "empresa X", números inventados)
- Não mudar a paleta para roxo/neon ou qualquer cor fora do dark+dourado
- Não transformar a página em página de produto — o Real Prev é apenas um bloco de credibilidade

## TÉCNICO
- HTML/CSS/JS estático; Bootstrap 5 permitido; Three.js via CDN apenas para o Sticker Peel
- Os 2 componentes Originkit chegam em mensagens separadas neste chat, em React — portar para vanilla JS, sem framework:
  - **Type Sequence** → H1 do hero (typewriter com fases typing/holding/deleting, cursor piscante dourado, prefers-reduced-motion)
  - **Sticker Peel** → logos de clientes (Three.js: SkinnedMesh com grid de bones 30×30, curl semicircular guiado pelo peel, sombra com ShadowMaterial; parâmetros hoverPeel 45 / pressPeel 64 / curlRotation 240° / tween 0.6s easeInOut)
- Reveal on scroll sutil nas seções; respeitar prefers-reduced-motion
- SEO: title "Moraes de Carvalho | Advocacia Empresarial de Excelência", meta description e keywords do site atual
- Links WhatsApp: https://wa.me/5511961894772 · Email: contato@mcap.com.br
