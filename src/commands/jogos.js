import fs from 'node:fs';
import path from 'node:path';
import { randomInt, randomItem, shuffle, normalize, clamp } from '../utils.js';

const quizQuestions = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'data/quiz.json'), 'utf8')
).questions;

const WORDS = [
  'abacaxi', 'computador', 'girafa', 'chocolate', 'montanha', 'bicicleta',
  'oceanografia', 'teclado', 'geladeira', 'paraquedas', 'abacate', 'nanico'
];

const GALLOWS = [
  '  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n  /   |\n      |\n=========',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n  / \\ |\n      |\n========='
];

const PPT_EMOJI = { pedra: '🪨', papel: '📄', tesoura: '✂️' };
const PPT_NAMES = { pedra: 'Pedra', papel: 'Papel', tesoura: 'Tesoura' };
const PPT_BEATS = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

function keyFor(ctx, type) {
  return `${ctx.jid}:${ctx.sender}:${type}`;
}

function pptChoice(value) {
  const text = normalize(value);
  if (['pedra', 'rock', '1'].includes(text)) return 'pedra';
  if (['papel', 'paper', '2'].includes(text)) return 'papel';
  if (['tesoura', 'tesoura', 'scissors', '3'].includes(text)) return 'tesoura';
  return null;
}

function board(word, guesses) {
  return [...word].map((letter) => (guesses.has(letter) ? letter : '_')).join(' ');
}

export const jogosCommands = [
  {
    name: 'ppt',
    aliases: ['pedra', 'jokempô', 'jokenpo'],
    category: 'Jogos',
    description: 'Pedra, papel e tesoura contra o bot',
    usage: '!ppt pedra',
    run(ctx) {
      const choice = pptChoice(ctx.args[0] || '');
      if (!choice) {
        return ctx.reply('Escolha: *pedra*, *papel* ou *tesoura*.\nEx: `!ppt pedra`');
      }
      const bot = randomItem(['pedra', 'papel', 'tesoura']);
      let result = 'Empate!';
      let emoji = '🤝';
      if (PPT_BEATS[choice] === bot) { result = 'Você ganhou! 🎉'; emoji = '🏆'; }
      if (PPT_BEATS[bot] === choice) { result = 'Eu ganhei! 😄'; emoji = '🤖'; }
      return ctx.reply(
        `${PPT_EMOJI[choice]} Você: *${PPT_NAMES[choice]}*\n` +
        `${PPT_EMOJI[bot]} Eu: *${PPT_NAMES[bot]}*\n\n${emoji} ${result}`,
        { react: emoji }
      );
    }
  },
  {
    name: 'dado',
    aliases: ['roll', 'rolar'],
    category: 'Jogos',
    description: 'Rolar dados (ex: 2d20)',
    usage: '!dado [quantidade]d[lados]',
    run(ctx) {
      const match = /^(\d*)d?(\d+)$/i.exec((ctx.args[0] || '').replace(/[^0-9d]/gi, ''));
      const amount = clamp(match ? Number(match[1] || 1) : 1, 1, 20);
      const sides = clamp(match ? Number(match[2]) : 6, 2, 1000);
      const rolls = Array.from({ length: amount }, () => randomInt(1, sides));
      const total = rolls.reduce((sum, value) => sum + value, 0);
      const formatted = rolls.map((value) => `\`${value}\``).join(' + ');
      return ctx.reply(
        `🎲 *${amount}d${sides}*\n${formatted}${amount > 1 ? ` = *${total}*` : ''}`,
        { react: '🎲' }
      );
    }
  },
  {
    name: 'caracoroa',
    aliases: ['coinflip', 'caraoudorada'],
    category: 'Jogos',
    description: 'Cara ou coroa',
    usage: '!moeda',
    run(ctx) {
      const result = randomItem(['Cara', 'Coroa']);
      return ctx.reply(`🪙 A moeda caiu em *${result}*!`, { react: '🪙' });
    }
  },
  {
    name: 'par',
    aliases: ['parouimpar', 'impar'],
    category: 'Jogos',
    description: 'Par ou ímpar contra o bot',
    usage: '!par par 5',
    run(ctx) {
      const choice = normalize(ctx.args[0] || '');
      if (!['par', 'impar', 'ímpar'].includes(choice)) {
        return ctx.reply('Use: `!par par 5` ou `!par impar 3`');
      }
      const number = clamp(Number.parseInt(ctx.args[1], 10) || randomInt(1, 10), 1, 10);
      const botNumber = randomInt(1, 10);
      const total = number + botNumber;
      const isEven = total % 2 === 0;
      const userWon = (choice === 'par') === isEven;
      return ctx.reply(
        `Você: *${number}* | Eu: *${botNumber}* | Total: *${total}* (${isEven ? 'par' : 'ímpar'})\n` +
        `${userWon ? 'Você ganhou! 🎉' : 'Eu ganhei! 🤖'}`,
        { react: userWon ? '🎉' : '🤖' }
      );
    }
  },
  {
    name: 'adivinha',
    aliases: ['adivinhar', 'numero'],
    category: 'Jogos',
    description: 'Adivinhe o número secreto',
    usage: '!adivinha [máximo]',
    run(ctx) {
      const key = keyFor(ctx, 'adivinha');
      const existing = ctx.store.getSession(key);
      if (existing && !['sair', 'stop', 'novo'].includes(normalize(ctx.args[0] || ''))) {
        return ctx.reply(`Você já tem um jogo aberto: tente um número de 1 a ${existing.max}.`);
      }
      if (existing) ctx.store.deleteSession(key);
      const max = clamp(Number.parseInt(ctx.args[0], 10) || 100, 10, 10000);
      ctx.store.session(key, { type: 'adivinha', secret: randomInt(1, max), max, attempts: 0 });
      return ctx.reply(`🎯 Pensei em um número entre *1* e *${max}*. Envie seu palpite! (${ctx.prefix}adivinha sair para sair)`);
    }
  },
  {
    name: 'quiz',
    aliases: ['pergunta', 'trivia'],
    category: 'Jogos',
    description: 'Quiz de conhecimento geral',
    usage: '!quiz [número da resposta]',
    run(ctx) {
      const key = keyFor(ctx, 'quiz');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0] || '');

      if (session && ['sair', 'stop', 'novo'].includes(arg)) {
        ctx.store.deleteSession(key);
        return ctx.reply(`Quiz encerrado. Pontuação: *${session.score}* acerto(s).`);
      }

      if (!session) {
        const question = randomItem(quizQuestions);
        session = ctx.store.session(key, {
          type: 'quiz', question, score: 0, correct: 0, asked: 0
        });
        return ctx.reply(formatQuiz(session));
      }

      if (arg) return answerQuiz(ctx, session, key, arg);
      return ctx.reply(formatQuiz(session));
    }
  },
  {
    name: 'forca',
    aliases: ['hangman'],
    category: 'Jogos',
    description: 'Jogo da forca',
    usage: '!forca [letra]',
    run(ctx) {
      const key = keyFor(ctx, 'forca');
      let session = ctx.store.getSession(key);
      const arg = normalize(ctx.args[0] || '');

      if (session && ['sair', 'stop', 'novo'].includes(arg)) {
        ctx.store.deleteSession(key);
        return ctx.reply(`Forca encerrada. A palavra era *${session.word}*.`);
      }

      if (!session) {
        const word = randomItem(WORDS.filter((item) => !/[^\x00-\x7F]/.test(item))).toUpperCase();
        session = ctx.store.session(key, {
          type: 'forca', word, guesses: [], errors: 0, maxErrors: 6
        });
        return ctx.reply(
          `*Jogo da Forca*\n\n${GALLOWS[0]}\n\n${board(word, new Set())}\n\nEnvie uma letra ou \`${ctx.prefix}forca letra\`.`
        );
      }

      if (arg) return guessLetter(ctx, session, key, arg);
      return ctx.reply('Envie uma letra para jogar.');
    }
  },
  {
    name: 'sorteio',
    aliases: ['sortear', 'sorte'],
    category: 'Jogos',
    description: 'Sortear membros do grupo',
    usage: '!sorteio [quantidade]',
    run(ctx) {
      if (!ctx.isGroup) return ctx.reply('Esse comando só funciona em grupos.');
      const participants = (ctx.groupMembers || [])
        .filter((member) => !member.isAdmin && !/bot/i.test(member.id || ''))
        .map((member) => member.id);
      if (!participants.length) return ctx.reply('Não encontrei participantes para o sorteio.');
      const amount = clamp(Number.parseInt(ctx.args[0], 10) || 1, 1, participants.length);
      const winners = shuffle(participants).slice(0, amount);
      return ctx.reply(
        `🎉 *Sorteio*\n\n${winners.map((winner, index) => `${index + 1}º: @${winner.split('@')[0]}`).join('\n')}`,
        { mentions: winners, react: '🎉' }
      );
    }
  },
  {
    name: 'enquete',
    aliases: ['poll', 'votar'],
    category: 'Jogos',
    description: 'Criar uma enquete no grupo',
    usage: '!enquete Pergunta|Opção 1|Opção 2',
    run(ctx) {
      const parts = ctx.text.split('|').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 3) {
        return ctx.reply(`Use: \`${ctx.prefix}enquete Pergunta|Opção 1|Opção 2\``);
      }
      const [name, ...options] = parts;
      if (options.length > 10) return ctx.reply('Máximo de 10 opções.');
      return ctx.send({ poll: { name, options: options.map((optionName) => ({ optionName })), selectableCount: 1 } });
    }
  }
];

function formatQuiz(session) {
  const { question } = session;
  const options = question.options.map((option, index) => `${index + 1}️⃣ ${option}`).join('\n');
  return `🧠 *Quiz* (${session.asked ? `placar ${session.correct}/${session.asked}` : 'nova rodada'})\n\n` +
    `*${question.question}*\n\n${options}\n\nResponda com o número da opção.`;
}

function answerQuiz(ctx, session, key, answer) {
  const index = Number.parseInt(answer, 10) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= session.question.options.length) {
    return ctx.reply('Escolha um número válido entre as opções.');
  }
  const correct = index === session.question.answer - 1;
  const answerText = session.question.options[session.question.answer - 1];
  session.asked += 1;
  if (correct) session.score += 1;
  if (correct) session.correct += 1;
  ctx.store.touchSession(key, session);
  const nextQuestion = randomItem(quizQuestions);
  ctx.store.touchSession(key, { question: nextQuestion });
  return ctx.reply(
    `${correct ? '✅ Acertou!' : `❌ Errou! A resposta era *${answerText}*.`}\n\n` +
    `Placar: *${session.correct}/${session.asked}*\n\n${formatQuiz(ctx.store.getSession(key))}`,
    { react: correct ? '✅' : '❌' }
  );
}

function guessLetter(ctx, session, key, letter) {
  const clean = letter.replace(/[^a-z]/gi, '').slice(0, 1).toLowerCase();
  if (!clean) return ctx.reply('Envie apenas uma letra.');
  if (session.guesses.includes(clean)) return ctx.reply('Você já tentou essa letra.');

  session.guesses.push(clean);
  if (!session.word.toLowerCase().includes(clean)) session.errors += 1;
  ctx.store.touchSession(key, session);

  const current = board(session.word, new Set(session.guesses));
  const won = !current.includes('_');
  const lost = session.errors >= session.maxErrors;

  if (won || lost) {
    ctx.store.deleteSession(key);
    const result = won ? '🎉 Você ganhou!' : `💀 Você perdeu! A palavra era *${session.word}*.`;
    return ctx.reply(`${GALLOWS[session.errors]}\n\n${current}\n\n${result}`, { react: won ? '🎉' : '💀' });
  }

  return ctx.reply(
    `${GALLOWS[session.errors]}\n\n${current}\n\n` +
    `Erros: ${session.errors}/${session.maxErrors} | Letras: ${session.guesses.join(', ')}`
  );
}

export function handleGameMessage(ctx) {
  const plain = ctx.body.trim();
  if (!plain) return false;

  const adivinhaKey = keyFor(ctx, 'adivinha');
  const adivinha = ctx.store.getSession(adivinhaKey);
  if (adivinha && /^\d+$/.test(plain)) {
    const guess = Number.parseInt(plain, 10);
    adivinha.attempts += 1;
    ctx.store.touchSession(adivinhaKey, adivinha);
    if (guess === adivinha.secret) {
      ctx.store.deleteSession(adivinhaKey);
      return ctx.reply(`🎯 Acertou! O número era *${guess}* em ${adivinha.attempts} tentativa(s).`, { react: '🎯' });
    }
    const hint = guess < adivinha.secret ? 'É maior ⬆️' : 'É menor ⬇️';
    const near = Math.abs(guess - adivinha.secret) <= Math.max(2, Math.round(adivinha.max * 0.03)) ? ' (quase!)' : '';
    return ctx.reply(`${hint}${near} Tentativa ${adivinha.attempts}.`);
  }

  const forcaKey = keyFor(ctx, 'forca');
  const forca = ctx.store.getSession(forcaKey);
  if (forca && /^[a-zà-ÿ]$/i.test(plain)) {
    guessLetter(ctx, forca, forcaKey, plain);
    return true;
  }

  const quizKey = keyFor(ctx, 'quiz');
  const quiz = ctx.store.getSession(quizKey);
  if (quiz && /^[1-9]$/.test(plain)) {
    answerQuiz(ctx, quiz, quizKey, plain);
    return true;
  }

  return false;
}

export const gameTypes = ['adivinha', 'forca', 'quiz'];
