# Fênix 🔥

Bot de WhatsApp completo feito com [Baileys](https://github.com/WhiskeySockets/Baileys): piadas, jogos, utilidades, sistema de XP e moderação de grupos. Não precisa de navegador nem de API paga.

Logo: `assets/fenix-logo.png` (aplicada automaticamente ao perfil do bot ao conectar).

Assinatura visual: `assets/fenix-assinatura.png`. As respostas de texto também terminam com `BOT_SIGNATURE` (`— 🔥 *Fênix* — piadas, jogos e utilidades`); defina vazio para desativar.

## Requisitos

- **Node.js 20 ou superior** (Baileys 6.7.22 exige Node >= 20)
- WhatsApp ativo no celular para escanear o QR Code
- **ffmpeg** (opcional): figurinhas animadas, gerador de memes e `!play`/`!playvid`
- **yt-dlp** (opcional): áudio/vídeo do YouTube em `!play`/`!playvid`
- **sharp** (opcional): figurinhas estáticas e geração da logo — `npm install sharp`

## Instalação

```bash
git clone <seu-repositorio> brinca-bot
cd brinca-bot
npm install --legacy-peer-deps
cp .env.example .env
npm start
```

Para habilitar `!play` e `!playvid`:

```bash
python3 -m pip install --user --break-system-packages yt-dlp
```

O bot detecta `~/.local/bin/yt-dlp` automaticamente. Se preferir fixar outro caminho, defina `YTDLP_BIN` no `.env`.

Na primeira execução, um QR Code aparece no terminal. Abra o WhatsApp → **Aparelhos conectados** → **Conectar aparelho** e escaneie. A sessão fica salva em `auth_info/` e as configurações em `data/runtime/`. Se preferir um código curto de 8 caracteres, defina `PAIRING_PHONE` no `.env` com o número do WhatsApp (somente dígitos, com DDI); o bot exibe o código no terminal e você usa **Conectar com número de telefone**.

> `npm start` usa um launcher que detecta automaticamente um Node 20+ local (instalado em `~/.node20` neste ambiente). Em outra máquina, instale o Node 20 com `nvm install 20 && nvm use 20`.

## Estabilidade

O bot cria um lock em `data/runtime/bot.lock` e impede que duas instâncias usem a mesma sessão ao mesmo tempo. Se uma instância travar sem liberar o lock, o PID é validado e um lock órfão é removido automaticamente na próxima inicialização.

Para reiniciar com segurança, use `npm stop && npm start`. O `npm stop` encerra o launcher e o processo filho `index.js`, evitando processos órfãos que ainda usam a sessão.

Os logs são salvos em `data/runtime/bot.log` com rotação automática (5 MB por arquivo, 5 arquivos). Logs internos repetitivos do libsignal são resumidos a cada 100 ocorrências para não poluir o terminal.

Se aparecerem muitos erros `Bad MAC` ou `MessageCounterError`, pare o bot e use `npm run prune:sessions -- --dry-run` para simular a limpeza. O comando real, `npm run prune:sessions`, copia `auth_info/` para `data/auth-backups/` e mantém apenas a sessão aberta mais recente de cada arquivo, dispensando um novo QR Code. Para podar um arquivo específico, use `npm run prune:sessions -- session-6438793568280.0.json`. Se os erros voltarem logo após a poda, inicie com `LOG_SESSION_ERRORS=true npm start` para registrar os stacks completos em `bot.log` e identificar o JID responsável.

Para rodar com reinício automático, instale o PM2 e use:

```bash
npm install -g pm2
npm run pm2:start
npm run pm2:logs
```

O `ecosystem.config.cjs` já define uma única instância, `autorestart`, limite de memória e reinício após queda. Sem PM2, continue usando `npm start`.

## Comandos

Prefixo padrão: `!` (alternativo: `/`). Use `!ajuda` para abrir o menu em caixa estilo Ted Bot, agrupado por categoria.
O menu aceita `!ajuda <nº>`, `!ajuda <categoria>` (ex.: `!ajuda Jogos`) e `!ajuda tudo` para a lista completa.

### Informação
| Comando | Descrição |
|---|---|
| `!ajuda [categoria]` | Lista comandos (ex: `!ajuda Jogos`) |
| `!infogrupo` | Nome, descrição, admins e participantes do grupo |
| `!ping` | Testa se o bot está online |
| `!status` | Uptime, mensagens, usuários e líder do ranking |

### Diversão
| Comando | Descrição |
|---|---|
| `!piada [categoria]` | Piada aleatória: engraçada, charada, nerd, infantil, pai |
| `!charada` | Charada com desafio |
| `!curiosidade` | Fato aleatório |
| `!frase` | Frase motivacional |
| `!zoeira [@user]` | Zoeira aleatória |
| `!pai` | Piada de pai clássica |

### Jogos
| Comando | Descrição |
|---|---|
| `!ppt pedra` | Pedra, papel e tesoura |
| `!dado 2d20` | Rolar dados |
| `!caracoroa` | Cara ou coroa |
| `!par par 5` | Par ou ímpar |
| `!adivinha [max]` | Adivinhe o número secreto |
| `!quiz [nº]` | Quiz de conhecimento geral com placar |
| `!forca [letra]` | Jogo da forca |
| `!sorteio [n]` | Sortear membros do grupo |
| `!enquete Pergunta\|Opção 1\|Opção 2` | Enquete nativa do WhatsApp |
| `!truco [1-3]` | Truco simplificado, melhor de 3 rodadas |
| `!xadrez e2e4` | Xadrez simplificado contra o bot |
| `!bingo` | Bingo com cartão e sorteio automático |
| `!uno [índice]` | UNO simplificado contra o bot |
| `!tesouro [número]` | Caça ao tesouro no grupo |
| `!quememais Pergunta? @a @b` | Enquete "quem é mais...?" com votação |
| `!velha [1-9]` | Jogo da velha contra o bot |

### Economia
| Comando | Descrição |
|---|---|
| `!carteira` | Saldo de moedas e sequência diária |
| `!daily` | Recompensa diária de XP + moedas (com streak) |
| `!loja` | Catálogo de títulos e itens |
| `!comprar <id> [xp]` | Comprar com moedas ou XP |
| `!titulo <id\|none>` | Equipar/remover título |
| `!apostar 50 cara` | Apostar moedas em cara/coroa |
| `!transferir @user 50` | Enviar moedas para outro usuário |
| `!banco` | Carteira, banco, juros e impostos |
| `!depositar <valor>`, `!sacar <valor>` | Guardar/retirar moedas do banco |
| `!trabalho` | Trabalhar para ganhar moedas (3 min) |
| `!investir <10 a 500>` | Investir com risco de lucro ou prejuízo (10 min) |
| `!imposto [pagar]` | Consultar ou pagar impostos pendentes |

### Eventos
| Comando | Descrição |
|---|---|
| `!evento` | Evento semanal, progresso e recompensa |
| `!evento resgatar` | Resgatar recompensa quando a meta é atingida |
| `!economiarank` | Ranking de economia com bônus para o top 3 |

Eventos rotacionam toda semana e podem ser de economia, trabalho, missões, investimentos ou batalhas. O top 3 do ranking recebe +50%, +25% e +10% na recompensa.

### RPG
| Comando | Descrição |
|---|---|
| `!rpg guerreiro\|mago\|arqueiro` | Criar/ver personagem |
| `!batalha` | Batalha por turnos contra monstro |
| `!chefe` | Desafiar o Dragão Ancião (4h) |
| `!atacar`, `!defender`, `!curar`, `!fugir` | Ações em batalha |
| `!descansar` | Recuperar HP (10 min) |
| `!inventario`, `!usar pocao` | Itens e poções |
| `!missoes`, `!missoes resgatar [id]` | Missões diárias com recompensas |

### Mídia
| Comando | Descrição |
|---|---|
| `!attp <texto>` | Figurinha animada com texto colorido piscando (ffmpeg) |
| `!figurinhaanimada` | Vídeo/GIF → figurinha animada (ffmpeg) |
| `!meme Topo\|Base` | Gerar imagem com texto |
| `!ocr` | Extrair texto de imagem (OCR.Space) |
| `!play nome ou URL` | Baixar áudio do YouTube (yt-dlp) |
| `!playvid nome ou URL` | Baixar vídeo do YouTube (yt-dlp, até `VIDEO_LIMIT_SECONDS`, padrão 600s) |

### Utilidades
| Comando | Descrição |
|---|---|
| `!calc (2+3)*4` | Calculadora segura (sem `eval`) |
| `!senha 16` | Gerador de senhas |
| `!cep 01001-000` | Consulta ViaCEP |
| `!clima São Paulo` ou `!clima Alvorada RS` | Clima atual (Open-Meteo) |
| `!wiki Brasil` | Resumo da Wikipédia |
| `!traduzir pt=en olá` | Tradução (MyMemory) |
| `!moeda 100 BRL USD` | Conversão de moedas (Frankfurter) |
| `!horario [cidade]` | Hora em várias cidades |
| `!figurinha` | Imagem → figurinha (requer pacote `sharp`) |
| `!lembrete 10m tomar água` | Lembrete no chat |

### Social
| Comando | Descrição |
|---|---|
| `!rank` | Ranking de XP com títulos |
| `!nivel` | Seu nível, progresso e saldo |

### Atividade
| Comando | Descrição |
|---|---|
| `!rankativo` | Ranking dos membros mais ativos do grupo |
| `!inativos [mínimo]` | Listar membros com pouca atividade (admin) |

### Administração (apenas admins do grupo)
| Comando | Descrição |
|---|---|
| `!antilink on\|off` | Bloquear links |
| `!dominios add exemplo.com\|del\|list` | Domínios liberados do anti-link |
| `!filtro on\|off` | Filtro de palavrões |
| `!boasvindas on\|off\|texto` | Mensagem para novos membros (`@user`) |
| `!autoresposta add oi\|Olá!` | Resposta automática por gatilho |
| `!autofigu on\|off` | Converter imagens em figurinhas automaticamente |
| `!mute`, `!unmute` | Silenciar/liberar membro |
| `!advertir`, `!tiraradvertencia` | Controle de advertências |
| `!advertencias` | Listar advertências registradas |
| `!regras`, `!regras add texto`, `!regras del número` | Regras do grupo |
| `!palavrao add\|del\|list` | Palavras proibidas personalizadas |
| `!blacklist add\|del\|list` | Lista negra do grupo |
| `!promover`, `!rebaixar` | Gerenciar administradores |
| `!fixar`, `!desfixar` | Fixar/desfixar mensagem respondida |
| `!marcar`, `!hidetag` | Mencionar todos (visível ou oculto) |
| `!cooldown 2500` | Intervalo entre comandos no grupo |
| `!link` | Link de convite do grupo |
| `!kick` | Remover membro (respondendo à mensagem dele) |
| `!backup` | Enviar arquivos de dados (somente dono) |

## Configuração (.env)

Copie `.env.example` para `.env`. Principais opções: `PREFIX`, `OWNER_NUMBER`, `BOT_NAME`, `BOT_DESCRIPTION`, `BOT_LOGO`, `BOT_SIGNATURE`, `TZ`, `RATE_LIMIT`, `COOLDOWN_MS`, `AUTO_READ`, `WELCOME_ENABLED`, `ANTILINK_DEFAULT`, `FILTER_DEFAULT`, `XP_PER_MESSAGE`, `LOG_LEVEL`, `LOG_TO_FILE`, `LOG_FILE`, `LOG_MAX_BYTES`, `LOG_MAX_FILES`, `LOG_SESSION_ERRORS`, `LOG_INCOMING_MESSAGES`, `INSTANCE_LOCK_FILE`, `HEALTH_ALERTS`, `HEALTH_ALERT_JID`, `SESSION_DIR`, `CLEAR_SESSION_ON_LOGOUT`, `OCR_API_KEY`, `YTDLP_BIN`, `VIDEO_LIMIT_SECONDS`.

## Docker

```bash
docker build -t brincabot .
docker run -it --rm -v "$PWD/auth_info:/app/auth_info" -v "$PWD/data:/app/data" --env-file .env brincabot
```

## Testes

```bash
npm test
```

## Solução de problemas

- **QR Code aparece a cada inicialização**: a sessão fica em `auth_info/`. Não apague essa pasta; o bot agora preserva a sessão mesmo após quedas de conexão. Se precisar vincular de novo, rode `npm run reset:session`. No Docker, use o volume `-v "$PWD/auth_info:/app/auth_info"` para não perder a sessão ao recriar o container.
- **Sessão invalidada pelo WhatsApp**: se o vínculo foi removido no celular, rode `npm run reset:session` e escaneie o QR novamente.
- **Erro de sintaxe ao iniciar**: verifique se você usa Node 20+ (`node -v`).
- **Comandos não respondem**: confira o prefixo no `.env` e se o número está em `OWNER_NUMBER` para comandos de admin.
- **Figurinha indisponível**: instale o pacote opcional com `npm install sharp@0.32.6`.
- **"Já existe outra instância rodando"**: rode `npm stop && npm start` ou use `npm run pm2:restart`. Não inicie `npm start` e `pm2` ao mesmo tempo.
- **Quer ver os logs completos**: use `tail -f data/runtime/bot.log` ou `npm run pm2:logs`.

## Aviso

Automatize contas com responsabilidade. Use uma conta secundária e siga os [Termos de Uso do WhatsApp](https://www.whatsapp.com/legal/terms-of-service).
