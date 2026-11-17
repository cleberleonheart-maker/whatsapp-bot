import fs from 'node:fs';
import path from 'node:path';
import { randomItem, normalize } from '../utils.js';

const dataDir = path.resolve(process.cwd(), 'data');
const jokes = JSON.parse(fs.readFileSync(path.join(dataDir, 'jokes.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(dataDir, 'content.json'), 'utf8'));

const ZOEIRAS = [
  'Você é o tipo de pessoa que chega na festa e já pergunta se tem internet.',
  'Se diligência fosse piada, você estaria rindo agora.',
  'Tô com preguiça de pensar numa zoeira. Volte amanhã.',
  'Você tem a personalidade de um WiFi sem senha: todo mundo conecta, ninguém confia.',
  'Seu horóscopo hoje: não confie em ninguém que diga "confia em mim".',
  'Você é como um link encurtado: ninguém sabe para onde vai.',
  'Tô treinando para ser sarcástico. Já cheguei no nível "iniciante com ponto de exclamação".',
  'Se perguntarem se você é engraçado, diga que é "em desenvolvimento".',
  'Você é a prova de que o modo avião existe para dar uma pausa de você mesmo.',
  'Tentei pensar numa zoeira criativa, mas o café ainda não fez efeito.'
];

const CATEGORY_LABELS = {
  engracada: 'Engraçada',
  charada: 'Charada',
  nerd: 'Nerd',
  infantil: 'Infantil',
  pai: 'Piada de pai'
};

function pickJoke(category) {
  if (!category) {
    const all = Object.values(jokes).flat();
    return { text: randomItem(all), category: 'Surpresa' };
  }
  const key = normalize(category);
  const match = Object.keys(jokes).find((name) => normalize(name) === key ||
    normalize(CATEGORY_LABELS[name]) === key);
  if (!match) return null;
  return { text: randomItem(jokes[match]), category: CATEGORY_LABELS[match] };
}

export const diversaoCommands = [
  {
    name: 'piada',
    aliases: ['piadas', 'joke'],
    category: 'Diversão',
    description: 'Conta uma piada (ou escolha uma categoria)',
    usage: '!piada [engraçada|charada|nerd|infantil|pai]',
    run(ctx) {
      const selected = pickJoke(ctx.args.join(' '));
      if (!selected) {
        const options = Object.keys(CATEGORY_LABELS).map((key) => CATEGORY_LABELS[key]).join(', ');
        return ctx.reply(`Categorias disponíveis: ${options}.\nExemplo: \`${ctx.prefix}piada nerd\``);
      }
      return ctx.reply(`*Piada (${selected.category})*\n\n${selected.text}`);
    }
  },
  {
    name: 'charada',
    aliases: ['charadas', 'enigma'],
    category: 'Diversão',
    description: 'Um desafio de charada',
    usage: '!charada',
    run(ctx) {
      return ctx.reply(`*Charada*\n\n${randomItem(jokes.charada)}\n\nTente adivinhar e me diga a resposta!`);
    }
  },
  {
    name: 'curiosidade',
    aliases: ['curioso', 'fact', 'fato'],
    category: 'Diversão',
    description: 'Uma curiosidade aleatória',
    usage: '!curiosidade',
    run(ctx) {
      return ctx.reply(`*Curiosidade*\n\n${randomItem(content.facts)}`);
    }
  },
  {
    name: 'frase',
    aliases: ['motivacao', 'motivacional', 'quote'],
    category: 'Diversão',
    description: 'Frase motivacional aleatória',
    usage: '!frase',
    run(ctx) {
      return ctx.reply(`*Frase do dia*\n\n${randomItem(content.quotes)}`);
    }
  },
  {
    name: 'zoeira',
    aliases: ['zoar', 'zueira', 'piada2'],
    category: 'Diversão',
    description: 'Uma zoeira aleatória com você',
    usage: '!zoeira [@mencionado]',
    run(ctx) {
      const mention = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const target = mention ? `@${mention.split('@')[0]}` : '';
      return ctx.reply(`${target ? `${target} ` : ''}${randomItem(ZOEIRAS)}`, {
        mentions: mention ? [mention] : []
      });
    }
  },
  {
    name: 'pai',
    aliases: ['frasedepai', 'piadadepai'],
    category: 'Diversão',
    description: 'Uma piada de pai clássica',
    usage: '!meme',
    run(ctx) {
      return ctx.reply(`*Piada de pai*\n\n${randomItem(jokes.pai)}`);
    }
  }
];
