import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const ATTP_COLORS = ['0xFF3366', '0xFFD400', '0x34D399', '0x38BDF8', '0xA855F7', '0xFF7A00'];

function tempFile(extension) {
  return path.join(os.tmpdir(), `brincabot-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
}

function cleanup(...files) {
  for (const file of files) {
    try { fs.unlinkSync(file); } catch {}
  }
}

export function buildAttpLines(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!clean) return [];
  const lines = [];
  for (const word of clean.split(' ')) {
    const pieces = word.length > 14 ? word.match(/.{1,14}/g) : [word];
    for (const piece of pieces) {
      const last = lines[lines.length - 1];
      if (!last) {
        lines.push(piece);
      } else if (`${last} ${piece}`.length <= 14) {
        lines[lines.length - 1] = `${last} ${piece}`;
      } else {
        lines.push(piece);
      }
    }
  }
  if (lines.length <= 5) return lines;
  const kept = lines.slice(0, 5);
  kept[4] = `${kept[4].slice(0, 13)}…`;
  return kept;
}

export function attpFontSize(lines) {
  const longest = Math.max(0, ...lines.map((line) => line.length));
  if (longest <= 6) return 96;
  if (longest <= 10) return 78;
  if (longest <= 14) return 62;
  return 48;
}

export function buildAttpFilter(lines, textFile) {
  const fontSize = attpFontSize(lines);
  const filters = ATTP_COLORS.map((color, index) => {
    const enable = `enable='eq(mod(floor(t*6)\\,${ATTP_COLORS.length})\\,${index})'`;
    return `drawtext=fontfile=${FONT}:textfile=${textFile}:fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:shadowx=4:shadowy=4:shadowcolor=black:expansion=none:${enable}`;
  });
  return `${filters.join(',')},format=rgba`;
}

async function mediaBuffer(ctx) {
  const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo;
  const target = quoted?.quotedMessage ? { message: quoted.quotedMessage } : ctx.msg;
  const media = target.message?.videoMessage || target.message?.imageMessage || target.message?.documentMessage;
  if (!media) return null;
  const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
  return downloadMediaMessage(target, 'buffer', {}, { logger: ctx.sock.logger });
}

export async function imageToSticker(buffer) {
  const input = tempFile('img');
  const output = tempFile('webp');
  try {
    fs.writeFileSync(input, buffer);
    await exec('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2',
      '-frames:v', '1', '-c:v', 'libwebp', '-loop', '0', '-quality', '90', output
    ], { timeout: 30000, maxBuffer: 1024 * 1024 });
    return fs.readFileSync(output);
  } finally {
    cleanup(input, output);
  }
}

async function ocrWithApi(buffer) {
  const form = new FormData();
  form.append('apikey', config.ocrApiKey);
  form.append('language', 'por');
  form.append('isOverlayRequired', 'false');
  form.append('file', new Blob([buffer], { type: 'image/png' }), 'image.png');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST', body: form, signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] || 'Falha no OCR');
    return data.ParsedResults?.[0]?.ParsedText?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

export const midiaCommands = [
  {
    name: 'attp',
    aliases: ['textoanimado', 'textopiscante', 'animatedtext'],
    category: 'Mídia',
    description: 'Criar figurinha animada com texto colorido piscando',
    usage: '!attp <texto>',
    async run(ctx) {
      const lines = buildAttpLines(ctx.text);
      if (!lines.length) return ctx.reply(`Use: \`${ctx.prefix}attp Seu texto\``);
      const textFile = tempFile('txt');
      const output = tempFile('webp');
      try {
        fs.writeFileSync(textFile, lines.join('\n'));
        await exec('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 'lavfi', '-i', 'color=c=0x00000000:s=512x512:d=2:r=12',
          '-vf', buildAttpFilter(lines, textFile),
          '-frames:v', '24', '-an', '-c:v', 'libwebp_anim', '-loop', '0', '-quality', '85', output
        ], { timeout: 60000, maxBuffer: 1024 * 1024 });
        await ctx.sock.sendMessage(ctx.jid, { sticker: fs.readFileSync(output) }, { quoted: ctx.msg });
      } catch (error) {
        return ctx.reply(`Não consegui criar a figurinha de texto. ${error.message.split('\n')[0]}`);
      } finally {
        cleanup(textFile, output);
      }
    }
  },
  {
    name: 'figurinhaanimada',
    aliases: ['stickeranimado', 'webpanimado'],
    category: 'Mídia',
    description: 'Transformar um vídeo/GIF em figurinha animada',
    usage: '!figurinhaanimada (com vídeo ou respondendo a um vídeo)',
    async run(ctx) {
      const buffer = await mediaBuffer(ctx);
      if (!buffer) return ctx.reply('Envie um vídeo curto ou GIF junto com o comando.');
      const input = tempFile('mp4');
      const output = tempFile('webp');
      try {
        fs.writeFileSync(input, buffer);
        await exec('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
          '-vf', 'fps=12,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2',
          '-loop', '0', '-an', '-c:v', 'libwebp_anim', '-quality', '80', output
        ], { timeout: 60000, maxBuffer: 1024 * 1024 });
        await ctx.sock.sendMessage(ctx.jid, { sticker: fs.readFileSync(output) }, { quoted: ctx.msg });
        return ctx.react('✨');
      } catch {
        return ctx.reply('Não consegui criar a figurinha animada. Use um vídeo curto (até 10s).');
      } finally {
        cleanup(input, output);
      }
    }
  },
  {
    name: 'meme',
    aliases: ['gerarmeme', 'memegenerator'],
    category: 'Mídia',
    description: 'Gerar uma imagem com texto (topo|base)',
    usage: '!meme Topo|Base',
    async run(ctx) {
      const parts = ctx.text.split('|').map((part) => part.trim()).filter(Boolean).slice(0, 2);
      if (!parts.length) return ctx.reply(`Use: \`${ctx.prefix}meme Texto do topo|Texto da base\``);
      const topFile = tempFile('txt');
      const bottomFile = tempFile('txt');
      const output = tempFile('png');
      try {
        fs.writeFileSync(topFile, parts[0]);
        const filters = [
          `drawtext=fontfile=${FONT}:textfile=${topFile}:fontcolor=white:fontsize=52:x=(w-text_w)/2:y=60`
        ];
        if (parts[1]) {
          fs.writeFileSync(bottomFile, parts[1]);
          filters.push(`drawtext=fontfile=${FONT}:textfile=${bottomFile}:fontcolor=white:fontsize=52:x=(w-text_w)/2:y=h-text_h-60`);
        }
        await exec('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 'lavfi', '-i', 'color=c=0x111827:s=800x420',
          '-vf', filters.join(','), '-frames:v', '1', output
        ], { timeout: 30000, maxBuffer: 1024 * 1024 });
        await ctx.sock.sendMessage(ctx.jid, { image: fs.readFileSync(output), caption: '😂' }, { quoted: ctx.msg });
        return ctx.react('😂');
      } catch (error) {
        return ctx.reply(`Não consegui gerar o meme. ${error.message.split('\n')[0]}`);
      } finally {
        cleanup(topFile, bottomFile, output);
      }
    }
  },
  {
    name: 'ocr',
    aliases: ['lerimagem', 'textoimagem'],
    category: 'Mídia',
    description: 'Extrair texto de uma imagem',
    usage: '!ocr (com imagem ou respondendo a uma imagem)',
    async run(ctx) {
      const buffer = await mediaBuffer(ctx);
      if (!buffer) return ctx.reply('Envie uma imagem junto com o comando.');
      await ctx.react('👀');
      try {
        const text = await ocrWithApi(buffer);
        if (!text) return ctx.reply('Não encontrei texto legível na imagem.');
        return ctx.reply(`👀 *Texto encontrado*\n\n${text.length > 2000 ? `${text.slice(0, 1999)}…` : text}`);
      } catch {
        return ctx.reply('Não consegui ler a imagem agora. O serviço de OCR pode estar indisponível.');
      }
    }
  }
];
