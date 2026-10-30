# CALL OUT — VALORANT MAP GUIDE

Landing page responsiva em HTML, CSS e JavaScript puro, com visual tático preto/vermelho.

## Como executar

1. Extraia a pasta `call-out-valorant`.
2. Abra a pasta no Visual Studio Code.
3. Instale a extensão **Live Server** (opcional, mas recomendada).
4. Clique com o botão direito no `index.html` e escolha **Open with Live Server**.
5. Mantenha conexão com a internet para carregar artes, minimapas e callouts.

Também é possível abrir `index.html` diretamente, mas um servidor local costuma evitar limitações do navegador.

## O que já funciona

- Landing page com layout responsivo e identidade visual gamer.
- Galeria com busca por nome e filtro por rotação competitiva.
- Lista dos 13 mapas clássicos de Spike aceitos para o guia, independentemente da rotação atual.
- Abertura de guia por mapa com minimapa, marcadores e lista de callouts (quando disponíveis pela API).
- Filtro de callouts por nome e super-região.
- Seletor com todos os 17 formatos regionais de idioma do VALORANT (16 idiomas, com espanhol da Espanha e da América Latina). A API fornece nomes localizados quando disponíveis e dicionários locais complementam os termos genéricos que ainda vierem em inglês. A preferência fica salva no navegador, sem mensagens de diagnóstico na interface.
- Navegação mobile, animações, estados de carregamento e modo de fallback se a API estiver indisponível.
- Layout adaptado para celulares compactos, tablets e telas maiores: cartões em formato de linha nos celulares, menu recolhível e controles com áreas de toque maiores.
- Minimapa redimensionado conforme a área disponível, respeitando a proporção original para manter os pins alinhados.

## Arquivos

- `index.html`: estrutura semântica da página.
- `css/style.css`: identidade visual, layout e responsividade.
- `js/maps.js`: whitelist de mapas, rotação de referência e integração com a API.
- `js/main.js`: galeria, filtros, minimapas e interações.
- `assets/icons/callout.svg`: favicon simples do projeto.

## Dados externos

Os dados-base dos mapas são consultados em `https://valorant-api.com/v1/maps?language=en-US`. Para nomes localizados dos callouts, o projeto consulta o endpoint individual do mapa usando o locale selecionado (por exemplo, `?language=pt-BR`). A API e as imagens são mantidas por terceiros e podem mudar ou ficar indisponíveis. As imagens não são distribuídas dentro deste projeto.

A rotação de referência em `js/maps.js` está anotada como 22/10/2026 (Patch 13.08 / V26 Act 6). Atualize `CURRENT_COMPETITIVE_ROTATION` quando a rotação do jogo mudar. Essa configuração controla apenas o selo/filtro; os mapas fora da rotação continuam na galeria.

## Observação

Projeto de fã não oficial. VALORANT, Riot Games e os ativos associados são marcas e propriedade de seus respectivos titulares. Este projeto não é afiliado nem endossado pela Riot Games.


## Callouts competitivos

Os callouts em inglês continuam como fonte canônica para identificar cada região, manter os IDs e preservar as correções manuais dos pins. Ao escolher outro idioma, o guia consulta o endpoint do mapa com o parâmetro `language` e aplica os nomes localizados aos mesmos pontos, alinhando os registros pelas coordenadas originais. As traduções são carregadas sob demanda por mapa e idioma e ficam em cache durante a sessão. Quando a API não fornecer nomes localizados, os dicionários locais traduzem os termos genéricos reconhecidos; nomes próprios, apelidos competitivos e termos sem equivalência segura são preservados no texto original. A preferência de idioma fica salva no navegador. A nomenclatura pode variar entre jogadores e equipes; a busca também considera o nome original da API.


## Precisão do posicionamento dos callouts

A transformação das coordenadas usa os eixos corretos da API de VALORANT: `x` na imagem é calculado a partir de `location.y`, e `y` a partir de `location.x`. A moldura interativa assume a proporção nativa da minimapa carregada para que os pins compartilhem exatamente a mesma área da imagem. Se alterar essa lógica, não espelhe nem gire a imagem da minimapa.


## Diagnóstico e correção de pins

- O posicionamento usa a transformação oficial dos dados da minimapa: `x` visual deriva de `location.y`, e `y` visual deriva de `location.x`; não se deve girar nem espelhar o PNG.
- O tamanho da minimapa é ajustado à largura e à altura disponíveis. Mapas mais verticais não devem ser cortados pelo contêiner, e a camada dos pins usa exatamente a mesma caixa que a imagem.
- Quando a lista da API vem sem coordenadas, incompleta ou sem a transformação do mapa, o app tenta carregar os detalhes do mapa individualmente antes de desistir.
- A faixa de status da galeria informa quais mapas continuaram sem pins/coordenadas. O console do navegador (`F12` → Console) também exibe uma tabela por mapa com quantidade de callouts, quantidade de pins e validade da transformação.

Se a API estiver indisponível, os dados ao vivo não podem ser recuperados e os pins não são gerados artificialmente, para não mostrar localizações inventadas.

## Posições manuais preservadas

As correções de posicionamento já exportadas estão incorporadas em `js/pin-overrides.js` e são carregadas automaticamente quando o site abre. O arquivo contém 101 posições manuais distribuídas por 12 mapas. A interface pública não inclui mais ferramentas para editar, reverter ou exportar pins. O arquivo `js/maps.js` e as APIs de imagens foram mantidos sem alterações.



## Idiomas e tradução complementar

O seletor mantém as 17 opções regionais usadas pelo VALORANT para PC: inglês, alemão, espanhol (Espanha), espanhol (América Latina), francês, indonésio, italiano, português (Brasil), árabe, polonês, russo, turco, chinês tradicional, vietnamita, tailandês, japonês e coreano. Os dados localizados da API têm prioridade. Quando um termo ainda vier em inglês, o dicionário local tenta traduzir termos genéricos conhecidos, seguindo o mesmo princípio da tradução em português. Nomes próprios e callouts comunitários sem equivalência segura podem permanecer no idioma original; isso evita inventar nomes que não sejam usados pelos jogadores.
