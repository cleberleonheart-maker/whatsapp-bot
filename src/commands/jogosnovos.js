import { randomInt, randomItem, shuffle, normalize } from '../utils.js';

function keyFor(ctx, type) {
  return `${ctx.jid}:${ctx.sender}:${type}`;
}

function groupKey(ctx, type) {
  return `${ctx.jid}:${type}`;
}

const CARD_RANKS = Array.from({ length: 10 }, (_, index) => index + 1);

function dealDeck() {
  return shuffle(CARD_RANKS.flatMap((rank) => [rank, rank, rank, rank]));
}

function showHand(hand) {
  return hand.map((card, index) => `${index + 1}º: \`${card}\``).join(' | ');
}

const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

const SLIDES = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
};

function squareToPos(square) {
  return [square.charCodeAt(0) - 97, 8 - Number(square[1])];
}

function posToSquare(col, row) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function initialBoard() {
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let col = 0; col < 8; col += 1) {
    board[0][col] = `b${back[col]}`;
    board[1][col] = 'bP';
    board[6][col] = 'wP';
    board[7][col] = `w${back[col]}`;
  }
  return board;
}

function renderBoard(board) {
  const header = '  a b c d e f g h\n';
  return header + board.map((row, index) => `${8 - index} ${row.map((piece) => piece ? PIECES[piece] : '·').join(' ')} ${8 - index}`).join('\n') + `\n${header}`;
}

function chessMoves(board, color) {
  const moves = [];
  const own = (piece) => piece && piece[0] === color;
  const enemy = (piece) => piece && piece[0] !== color;
  const inside = (col, row) => col >= 0 && col < 8 && row >= 0 && row < 8;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!own(piece)) continue;
      const from = posToSquare(col, row);
      const type = piece[1];

      if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        if (inside(col, row + dir) && !board[row + dir][col]) {
          moves.push([from, posToSquare(col, row + dir)]);
          if (row === startRow && !board[row + dir * 2][col]) {
            moves.push([from, posToSquare(col, row + dir * 2)]);
          }
        }
        for (const side of [-1, 1]) {
          if (inside(col + side, row + dir) && enemy(board[row + dir][col + side])) {
            moves.push([from, posToSquare(col + side, row + dir)]);
          }
        }
      } else if (type === 'N') {
        for (const [dc, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
          if (inside(col + dc, row + dr) && !own(board[row + dr][col + dc])) {
            moves.push([from, posToSquare(col + dc, row + dr)]);
          }
        }
      } else if (SLIDES[type]) {
        for (const [dc, dr] of SLIDES[type]) {
          let nextCol = col + dc;
          let nextRow = row + dr;
          while (inside(nextCol, nextRow)) {
            if (own(board[nextRow][nextCol])) break;
            moves.push([from, posToSquare(nextCol, nextRow)]);
            if (enemy(board[nextRow][nextCol])) break;
            nextCol += dc;
            nextRow += dr;
          }
        }
      } else if (type === 'K') {
        for (const dc of [-1, 0, 1]) {
          for (const dr of [-1, 0, 1]) {
            if (!dc && !dr) continue;
            if (inside(col + dc, row + dr) && !own(board[row + dr][col + dc])) {
              moves.push([from, posToSquare(col + dc, row + dr)]);
            }
          }
        }
      }
    }
  }
  return moves;
}

function applyMove(board, from, to) {
  const [fromCol, fromRow] = squareToPos(from);
  const [toCol, toRow] = squareToPos(to);
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = null;
}

function chessLine(session) {
  return `${renderBoard(session.board)}\n\nVez das brancas: use \`${session.prefix}xadrez e2e4\`.`;
}

const UNO_COLORS = ['🔴', '🟡', '🟢', '🔵'];

function buildUnoDeck() {
  const deck = [];
  for (const color of UNO_COLORS) {
    for (let number = 0; number <= 9; number += 1) {
      deck.push(`${color}${number}`);
      if (number > 0) deck.push(`${color}${number}`);
    }
  }
  return shuffle(deck);
}

function isUnoPlayable(card, current) {
  return card[0] === current[0] || card.slice(1) === current.slice(1);
}

function bingoCard() {
  const numbers = shuffle(Array.from({ length: 75 }, (_, index) => index + 1)).slice(0, 24);
  const card = [];
  let index = 0;
  for (let row = 0; row < 5; row += 1) {
    const line = [];
    for (let col = 0; col < 5; col += 1) {
      line.push(row === 2 && col === 2 ? null : numbers[index++]);
    }
    card.push(line);
  }
  return card;
}

function hasBingoLine(card, marked) {
  const rows = card.some((row) => row.every((value) => value === null || marked.has(value)));
  const cols = card[0].some((_, col) => card.every((row) => row[col] === null || marked.has(row[col])));
  const diag1 = card.every((row, index) => row[index] === null || marked.has(row[index]));
  const diag2 = card.every((row, index) => row[4 - index] === null || marked.has(row[4 - index]));
  return rows || cols || diag1 || diag2;
}

const VELHA_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function velhaWinner(board) {
  for (const [a, b, c] of VELHA_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.includes(null) ? null : 'empate';
}

function renderVelha(board) {
  const cells = board.map((value, index) => value ? ` ${value} ` : ` ${index + 1} `);
  return [0, 3, 6].map((row) => cells.slice(row, row + 3).join('│')).join('\n───┼───┼───\n');
}

function velhaBotMove(board) {
  const empty = board.map((value, index) => value ? null : index).filter((index) => index !== null);
  if (!empty.length) return null;
  for (const piece of ['O', 'X']) {
    for (const index of empty) {
      const copy = [...board];
      copy[index] = piece;
      if (velhaWinner(copy) === piece) return index;
    }
  }
  for (const index of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
    if (board[index] === null) return index;
  }
  return randomItem(empty);
}

function playVelhaTurn(ctx, session, key, position) {
  if (session.board[position]) return ctx.reply('Essa casa já está ocupada. Escolha outra de 1 a 9.');
  session.board[position] = 'X';
  let result = velhaWinner(session.board);
  if (result) {
    ctx.store.deleteSession(key);
    const text = result === 'X' ? '🎉 Você venceu! +25 moedas' : result === 'O' ? '🤖 Eu venci!' : '🤝 Empate!';
    if (result === 'X') ctx.store.addCoins(ctx.sender, 25);
    return ctx.reply(`${text}\n\n${renderVelha(session.board)}`, { react: result === 'X' ? '🎉' : '🤖' });
  }
  const botIndex = velhaBotMove(session.board);
  session.board[botIndex] = 'O';
  result = velhaWinner(session.board);
  if (result) {
    ctx.store.deleteSession(key);
    const text = result === 'O' ? '🤖 Eu venci!' : result === 'X' ? '🎉 Você venceu! +25 moedas' : '🤝 Empate!';
    if (result === 'X') ctx.store.addCoins(ctx.sender, 25);
    return ctx.reply(`${text}\n\n${renderVelha(session.board)}`, { react: result === 'O' ? '🤖' : '🎉' });
  }
  ctx.store.touchSession(key, session);
  return ctx.reply(`❌ *Jogo da velha*\n\n${renderVelha(session.board)}\n\nEscolha uma casa (1 a 9) ou \`${session.prefix}velha sair\`.`);
}

function renderBingo(card, marked) {
  return card.map((row) => row.map((value) => {
    if (value === null) return '⭐';
    return marked.has(value) ? `\`${value}\`` : String(value).padStart(2, '0');
  }).join(' | ')).join('\n');
}

export const novosJogosCommands = [
  {
    name: 'truco',
    aliases: ['truco2'],
    category: 'Jogos',
    description: 'Truco simplificado (melhor de 3 rodadas)',
    usage: '!truco 1 (índice da carta)',
    run(ctx) {
      const key = keyFor(ctx, 'truco');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0]);
      if (session && ['sair', 'stop'].includes(arg)) {
        ctx.store.deleteSession(key);
        return ctx.reply('Truco encerrado.');
      }
      if (!session) {
        const deck = dealDeck();
        session = ctx.store.session(key, {
          type: 'truco', hand: deck.slice(0, 3), botHand: deck.slice(3, 6),
          plays: [], botPlays: [], prefix: ctx.prefix
        });
        return ctx.reply(`🃏 *Truco* — suas cartas:\n\n${showHand(session.hand)}\n\nEscolha uma carta: \`${ctx.prefix}truco 1\``);
      }
      const index = Number.parseInt(arg, 10) - 1;
      if (!Number.isInteger(index) || !session.hand[index]) return ctx.reply('Escolha 1, 2 ou 3.');
      return playTrucoRound(ctx, session, key, index);
    }
  },
  {
    name: 'jogodavelha',
    aliases: ['velha', 'tictactoe', 'jpv'],
    category: 'Jogos',
    description: 'Jogo da velha contra o bot',
    usage: '!velha [1-9]',
    run(ctx) {
      const key = keyFor(ctx, 'velha');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0]);
      if (session && ['sair', 'stop'].includes(arg)) {
        ctx.store.deleteSession(key);
        return ctx.reply('Jogo da velha encerrado.');
      }
      if (!session) {
        session = ctx.store.session(key, {
          type: 'velha', board: Array(9).fill(null), prefix: ctx.prefix
        });
        return ctx.reply(`❌ *Jogo da velha*\n\n${renderVelha(session.board)}\n\nEscolha uma casa (1 a 9) ou responda com o número.`);
      }
      const position = Number.parseInt(arg, 10) - 1;
      if (!Number.isInteger(position) || position < 0 || position > 8) {
        return ctx.reply('Escolha uma casa de 1 a 9.');
      }
      return playVelhaTurn(ctx, session, key, position);
    }
  },
  {
    name: 'xadrez',
    aliases: ['chess'],
    category: 'Jogos',
    description: 'Xadrez simplificado contra o bot',
    usage: '!xadrez e2e4',
    run(ctx) {
      const key = keyFor(ctx, 'xadrez');
      let session = ctx.store.getSession(key);
      const move = normalize(ctx.args[0]);
      if (session && ['sair', 'stop', 'tabuleiro'].includes(move)) {
        if (move === 'tabuleiro') return ctx.reply(chessLine(session));
        ctx.store.deleteSession(key);
        return ctx.reply('Xadrez encerrado.');
      }
      if (!session) {
        session = ctx.store.session(key, {
          type: 'xadrez', board: initialBoard(), prefix: ctx.prefix, moves: 0
        });
        return ctx.reply(`♟️ *Xadrez simplificado*\n\n${chessLine(session)}`);
      }
      return playChessMove(ctx, session, key, move);
    }
  },
  {
    name: 'bingo',
    aliases: ['bingo2'],
    category: 'Jogos',
    description: 'Bingo com cartão e sorteio automático',
    usage: '!bingo | !bingo cartao',
    run(ctx) {
      const key = keyFor(ctx, 'bingo');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0]);
      if (session && ['cartao', 'card', 'sair'].includes(arg)) {
        if (arg === 'sair') {
          ctx.store.deleteSession(key);
          return ctx.reply('Bingo encerrado.');
        }
        return ctx.reply(`🎯 *Seu cartão*\n\n${renderBingo(session.card, new Set(session.marked))}`);
      }
      if (!session) {
        session = ctx.store.session(key, {
          type: 'bingo', card: bingoCard(), marked: [], drawn: []
        });
        return ctx.reply(`🎯 *Bingo iniciado!*\n\n${renderBingo(session.card, new Set())}\n\nUse \`${ctx.prefix}bingo\` para sortear o próximo número.`);
      }
      let number;
      do { number = randomInt(1, 75); } while (session.drawn.includes(number));
      session.drawn.push(number);
      if (session.card.flat().includes(number)) session.marked.push(number);
      ctx.store.touchSession(key, session);
      const found = session.card.flat().includes(number);
      if (hasBingoLine(session.card, new Set(session.marked))) {
        ctx.store.deleteSession(key);
        ctx.store.addCoins(ctx.sender, 75);
        return ctx.reply(`🎉 *BINGO!* Número ${number}.\n${renderBingo(session.card, new Set(session.marked))}\n\n+75 moedas!`, { react: '🎉' });
      }
      return ctx.reply(
        `🎲 Número sorteado: *${number}* ${found ? '✅ está no seu cartão!' : '❌ não está no seu cartão.'}\n` +
        `Sorteados: ${session.drawn.length}\n\n${renderBingo(session.card, new Set(session.marked))}`
      );
    }
  },
  {
    name: 'uno',
    aliases: ['uno2'],
    category: 'Jogos',
    description: 'UNO simplificado contra o bot',
    usage: '!uno [índice da carta]',
    run(ctx) {
      const key = keyFor(ctx, 'uno');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0]);
      if (session && ['sair', 'stop', 'mao'].includes(arg)) {
        if (arg === 'mao') return ctx.reply(unoStatus(session, ctx.prefix));
        ctx.store.deleteSession(key);
        return ctx.reply('UNO encerrado.');
      }
      if (!session) {
        const deck = buildUnoDeck();
        session = ctx.store.session(key, {
          type: 'uno', hand: deck.slice(0, 5), botHand: deck.slice(5, 10),
          current: deck[10], deck: deck.slice(11), prefix: ctx.prefix
        });
        return ctx.reply(`🃏 *UNO simplificado*\n\n${unoStatus(session, ctx.prefix)}`);
      }
      const index = Number.parseInt(arg, 10) - 1;
      if (!Number.isInteger(index) || !session.hand[index]) return ctx.reply('Escolha um índice válido da sua mão.');
      return playUnoTurn(ctx, session, key, index);
    }
  },
  {
    name: 'tesouro',
    aliases: ['cacatotesouro'],
    category: 'Jogos',
    description: 'Caça ao tesouro no grupo',
    usage: '!tesouro [número]',
    run(ctx) {
      if (!ctx.isGroup) return ctx.reply('Esse jogo funciona apenas em grupos.');
      const key = groupKey(ctx, 'tesouro');
      let session = ctx.store.getSession(key);
      if (!session) {
        const secret = randomInt(1, 100);
        session = ctx.store.session(key, { type: 'tesouro', secret, guesses: [], owner: ctx.sender });
        return ctx.reply(`🗺️ *Caça ao tesouro iniciada!* O tesouro está escondido entre 1 e 100. Use \`${ctx.prefix}tesouro <número>\` para procurar.`);
      }
      const guess = Number.parseInt(ctx.args[0], 10);
      if (!Number.isFinite(guess) || guess < 1 || guess > 100) {
        return ctx.reply(`Jogo em andamento. Tente \`${ctx.prefix}tesouro 42\`.`);
      }
      session.guesses.push({ sender: ctx.sender, guess });
      ctx.store.touchSession(key, session);
      if (guess === session.secret) {
        ctx.store.deleteSession(key);
        ctx.store.addCoins(ctx.sender, 60);
        return ctx.reply(`💎 @${ctx.sender.split('@')[0]} encontrou o tesouro em ${guess} e ganhou 60 moedas!`, {
          mentions: [ctx.sender], react: '💎'
        });
      }
      const distance = Math.abs(guess - session.secret);
      const hint = distance <= 3 ? '🔥 Muito quente!' : distance <= 10 ? '♨️ Quente' : distance <= 25 ? '🌤️ Morno' : '🧊 Frio';
      return ctx.reply(`${hint} Tentativa de @${ctx.sender.split('@')[0]}: ${guess}`, { mentions: [ctx.sender] });
    }
  },
  {
    name: 'quememais',
    aliases: ['quememais2', 'duelo'],
    category: 'Jogos',
    description: 'Enquete "quem é mais...?" entre dois membros',
    usage: '!quememais Pergunta? @user1 @user2',
    run(ctx) {
      if (!ctx.isGroup) return ctx.reply('Esse jogo funciona apenas em grupos.');
      const key = groupKey(ctx, 'quememais');
      let session = ctx.store.getSession(key);
      const mentioned = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const first = normalize(ctx.args[0]);

      if (session && ['resultado', 'resultados', 'sair'].includes(first)) {
        if (first === 'sair') {
          ctx.store.deleteSession(key);
          return ctx.reply('Enquete encerrada.');
        }
        return showVoteResults(ctx, session);
      }

      if (!session) {
        if (mentioned.length < 2) return ctx.reply(`Use: \`${ctx.prefix}quememais Quem é mais engraçado? @user1 @user2\``);
        const question = ctx.text.split('@').shift().trim() || 'Quem é mais?';
        session = ctx.store.session(key, {
          type: 'quememais', question, candidates: mentioned.slice(0, 2), votes: {}, prefix: ctx.prefix
        });
        return ctx.reply(
          `🗳️ *Quem é mais...?*\n\n*${question}*\n\n1️⃣ @${session.candidates[0].split('@')[0]}\n2️⃣ @${session.candidates[1].split('@')[0]}\n\nVote com \`${ctx.prefix}quememais 1\` ou \`2\`.`,
          { mentions: session.candidates }
        );
      }

      if (!['1', '2'].includes(first)) return ctx.reply('Vote com 1 ou 2.');
      if (session.votes[ctx.sender]) return ctx.reply('Você já votou nesta enquete.');
      session.votes[ctx.sender] = Number(first);
      ctx.store.touchSession(key, session);
      return ctx.reply('🗳️ Voto registrado! Use `!quememais resultado` para encerrar.');
    }
  }
];

function showVoteResults(ctx, session) {
  const counts = [0, 0];
  Object.values(session.votes).forEach((vote) => { counts[vote - 1] += 1; });
  ctx.store.deleteSession(groupKey(ctx, 'quememais'));
  const [first, second] = session.candidates;
  const winner = counts[0] === counts[1] ? '🤝 Empate!' : counts[0] > counts[1] ? first : second;
  return ctx.reply(
    `🏁 *Resultado: ${session.question}*\n\n` +
    `1️⃣ @${first.split('@')[0]}: ${counts[0]} voto(s)\n` +
    `2️⃣ @${second.split('@')[0]}: ${counts[1]} voto(s)\n\n` +
    `Veredito: @${winner === '🤝 Empate!' ? 'ninguém' : winner.split('@')[0]} ${winner === '🤝 Empate!' ? '— empate!' : '🏆'}`,
    { mentions: session.candidates }
  );
}

function playTrucoRound(ctx, session, key, index) {
  const playerCard = session.hand.splice(index, 1)[0];
  const botIndex = randomInt(0, session.botHand.length - 1);
  const botCard = session.botHand.splice(botIndex, 1)[0];
  session.plays.push(playerCard);
  session.botPlays.push(botCard);
  const playerWon = playerCard > botCard;
  const line = `Você jogou \`${playerCard}\` | Eu joguei \`${botCard}\` — ${playerWon ? 'você ganhou a rodada' : 'eu ganhei a rodada'}.`;
  const playerPoints = session.plays.filter((card, index) => card > session.botPlays[index]).length;
  const botPoints = session.plays.length - playerPoints;

  if (playerPoints === 2 || botPoints === 2 || !session.hand.length) {
    ctx.store.deleteSession(key);
    const won = playerPoints > botPoints;
    if (won) ctx.store.addCoins(ctx.sender, 30);
    return ctx.reply(`${line}\n\nPlacar: ${playerPoints} × ${botPoints}\n${won ? '🏆 Você ganhou! +30 moedas' : '🤖 Eu ganhei!'}`, { react: won ? '🏆' : '🤖' });
  }
  ctx.store.touchSession(key, session);
  return ctx.reply(`${line}\n\nPlacar: ${playerPoints} × ${botPoints}\nSuas cartas: ${showHand(session.hand)}`);
}

function playChessMove(ctx, session, key, move) {
  if (!/^[a-h][1-8][a-h][1-8]$/.test(move)) {
    return ctx.reply('Use notação como `e2e4` (origem + destino).');
  }
  const moves = chessMoves(session.board, 'w');
  if (!moves.some(([from, to]) => from === move.slice(0, 2) && to === move.slice(2))) {
    return ctx.reply('Movimento inválido para as brancas.');
  }
  applyMove(session.board, move.slice(0, 2), move.slice(2));
  const botMoves = chessMoves(session.board, 'b');
  if (!botMoves.length) {
    ctx.store.deleteSession(key);
    return ctx.reply(`♟️ Xeque-mate! Você venceu.\n\n${renderBoard(session.board)}`, { react: '♟️' });
  }
  const [from, to] = randomItem(botMoves);
  applyMove(session.board, from, to);
  ctx.store.touchSession(key, { board: session.board, moves: session.moves + 1 });
  return ctx.reply(`♟️ Você jogou ${move} | Eu joguei ${from}${to}\n\n${chessLine(session)}`);
}

function unoStatus(session, prefix) {
  return `Carta atual: *${session.current}*\n\nSua mão:\n${session.hand.map((card, index) => `${index + 1}️⃣ ${card}`).join('  ')}\n\n` +
    `Use \`${prefix}uno <número>\` para jogar uma carta compatível (mesma cor ou número).`;
}

function playUnoTurn(ctx, session, key, index) {
  const card = session.hand[index];
  if (!isUnoPlayable(card, session.current)) {
    return ctx.reply(`Carta inválida: ${card}. A atual é ${session.current}.`);
  }
  session.hand.splice(index, 1);
  session.current = card;
  if (!session.hand.length) {
    ctx.store.deleteSession(key);
    ctx.store.addCoins(ctx.sender, 50);
    return ctx.reply('🎉 Você zerou sua mão e ganhou 50 moedas!', { react: '🎉' });
  }
  const botIndex = session.botHand.findIndex((entry) => isUnoPlayable(entry, session.current));
  if (botIndex >= 0) {
    session.current = session.botHand.splice(botIndex, 1)[0];
  } else {
    if (session.deck.length) session.botHand.push(session.deck.pop());
    else {
      ctx.store.deleteSession(key);
      return ctx.reply('🤖 Sem cartas restantes: empate!');
    }
  }
  if (!session.botHand.length) {
    ctx.store.deleteSession(key);
    return ctx.reply('🤖 Eu zerei minha mão e ganhei!', { react: '🤖' });
  }
  ctx.store.touchSession(key, session);
  return ctx.reply(`Carta atual: *${session.current}*\n\n${unoStatus(session, ctx.prefix)}`);
}

export function handleMessage(ctx) {
  const plain = ctx.body.trim();
  if (!plain) return false;

  const trucoKey = keyFor(ctx, 'truco');
  if (ctx.store.getSession(trucoKey) && /^[1-3]$/.test(plain)) {
    playTrucoRound(ctx, ctx.store.getSession(trucoKey), trucoKey, Number(plain) - 1);
    return true;
  }

  const xadrezKey = keyFor(ctx, 'xadrez');
  if (ctx.store.getSession(xadrezKey) && /^[a-h][1-8][a-h][1-8]$/i.test(plain)) {
    playChessMove(ctx, ctx.store.getSession(xadrezKey), xadrezKey, plain.toLowerCase());
    return true;
  }

  const velhaKey = keyFor(ctx, 'velha');
  if (ctx.store.getSession(velhaKey) && /^[1-9]$/.test(plain)) {
    playVelhaTurn(ctx, ctx.store.getSession(velhaKey), velhaKey, Number(plain) - 1);
    return true;
  }

  const unoKey = keyFor(ctx, 'uno');
  if (ctx.store.getSession(unoKey) && /^[1-9]$/.test(plain)) {
    playUnoTurn(ctx, ctx.store.getSession(unoKey), unoKey, Number(plain) - 1);
    return true;
  }

  const bingoKey = keyFor(ctx, 'bingo');
  if (ctx.store.getSession(bingoKey) && normalize(plain) === 'cartao') {
    const session = ctx.store.getSession(bingoKey);
    ctx.reply(`🎯 *Seu cartão*\n\n${renderBingo(session.card, new Set(session.marked))}`);
    return true;
  }

  return false;
}
