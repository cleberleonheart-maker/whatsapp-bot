import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);
const AUDIO_LIMIT = 600;
export const VIDEO_LIMIT = Math.max(1, config.videoLimitSeconds || 600);

function resolvePath(value) {
  const expanded = String(value).replace(/^~(?=\/)/, os.homedir());
  return expanded.includes('/') ? path.resolve(expanded) : expanded;
}

export function resolveYtDlp() {
  const candidates = [config.ytdlpBin, process.env.YTDLP_BIN, 'yt-dlp', path.join(os.homedir(), '.local/bin/yt-dlp'), '/usr/local/bin/yt-dlp'];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolvePath(candidate);
    if (resolved.includes('/') && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }
  return 'yt-dlp';
}

export function resolveTarget(query) {
  const clean = String(query || '').trim();
  if (!clean) return null;
  if (/^(https?:\/\/|www\.youtu|\w+\.com\/|youtu\.be\/)/i.test(clean)) return clean;
  return `ytsearch1:${clean}`;
}

export async function resolveUrl(query) {
  const target = resolveTarget(query);
  if (!target) throw new Error('Consulta vazia');
  const { stdout } = await exec(resolveYtDlp(), [
    '--no-warnings',
    '--no-playlist',
    '--skip-download',
    '--print', '%(webpage_url)s|%(duration)s',
    target
  ], { timeout: 60000, maxBuffer: 256 * 1024 });
  const [url, rawDuration] = stdout.trim().split('\n')[0].split('|');
  if (!/^https?:\/\//i.test(url || '')) throw new Error('Nenhum resultado encontrado');
  return { url, duration: Number(rawDuration) || null };
}

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brincabot-play-'));
}

function findDownloaded(directory, video) {
  const extensions = video ? ['.mp4', '.webm', '.mkv'] : ['.opus', '.m4a', '.mp3', '.webm'];
  const files = fs.readdirSync(directory)
    .map((name) => path.join(directory, name))
    .filter((file) => fs.statSync(file).isFile());
  for (const extension of extensions) {
    const match = files.find((file) => file.toLowerCase().endsWith(extension));
    if (match) return match;
  }
  return files[0] || null;
}

async function normalizeVideo(file, directory) {
  const output = path.join(directory, 'whatsapp.mp4');
  await exec('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', file,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart', '-max_muxing_queue_size', '1024', output
  ], { timeout: 300000, maxBuffer: 1024 * 1024 });
  return output;
}

async function download(query, video) {
  const { url, duration } = await resolveUrl(query);
  if (video && duration && duration > VIDEO_LIMIT) throw new Error(`Vídeo com ${Math.round(duration)}s excede o limite de ${VIDEO_LIMIT}s`);
  const directory = tempDirectory();
  const args = [
    '--no-warnings',
    '--no-progress',
    '--no-playlist',
    '--socket-timeout', '20',
    '--retries', '2',
    '--max-filesize', video ? '30M' : '20M',
    '--output', path.join(directory, '%(id)s.%(ext)s')
  ];
  if (video) {
    args.push('-f', 'worstvideo+worstaudio/worst', '--merge-output-format', 'mp4', '--match-filter', `duration <= ${VIDEO_LIMIT}`);
  } else {
    args.push('--download-sections', `*0-${AUDIO_LIMIT}`, '--force-keyframes-at-cuts', '-x', '--audio-format', 'opus', '--audio-quality', '96K');
  }
  args.push(url);
  try {
    await exec(resolveYtDlp(), args, { timeout: video ? Math.min(600000, VIDEO_LIMIT * 1000 + 120000) : 180000, maxBuffer: 1024 * 1024 });
    let file = findDownloaded(directory, video);
    if (!file) throw new Error('Nenhum arquivo baixado');
    if (video) file = await normalizeVideo(file, directory);
    const buffer = fs.readFileSync(file);
    if (!buffer.length) throw new Error('Arquivo vazio');
    return { buffer, name: video ? 'video.mp4' : path.basename(file) };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function label(text) {
  const clean = String(text || '').replace(/[`*_~]/g, '').trim();
  return clean.length > 160 ? `${clean.slice(0, 159)}…` : clean;
}

function errorText(error) {
  const lines = String(error?.stderr || '').trim().split('\n').filter(Boolean);
  return (lines.at(-1) || String(error?.message || 'Erro desconhecido').split('\n')[0]).slice(0, 180);
}

async function presence(ctx, state) {
  try { await ctx.sock.sendPresenceUpdate?.(state, ctx.jid); } catch {}
}

export const playCommands = [
  {
    name: 'play',
    aliases: ['tomp3', 'musica', 'yt'],
    category: 'Mídia',
    description: 'Baixar áudio do YouTube por nome ou URL',
    usage: '!play nome da música ou URL',
    async run(ctx) {
      const query = ctx.text.trim();
      if (!query) return ctx.reply(`Use: \`${ctx.prefix}play nome da música ou URL\`.`);
      await ctx.react?.('🔎');
      try {
        const result = await download(query, false);
        await presence(ctx, 'recording');
        try {
          await ctx.sock.sendMessage(ctx.jid, {
            audio: result.buffer,
            ptt: true,
            mimetype: 'audio/ogg; codecs=opus',
            fileName: 'audio.opus'
          }, { quoted: ctx.msg });
        } finally {
          await presence(ctx, 'paused');
        }
        await ctx.reply(`🎵 *Tocando agora*\n${label(query)}`);
        return ctx.react?.('✅');
      } catch (error) {
        await presence(ctx, 'paused');
        return ctx.reply(`Não consegui baixar o áudio. ${errorText(error)}`);
      }
    }
  },
  {
    name: 'playvid',
    aliases: ['ytv', 'video'],
    category: 'Mídia',
    description: 'Baixar vídeo do YouTube por nome ou URL',
    usage: '!playvid nome do vídeo ou URL',
    async run(ctx) {
      const query = ctx.text.trim();
      if (!query) return ctx.reply(`Use: \`${ctx.prefix}playvid nome do vídeo ou URL\`.`);
      await ctx.react?.('🔎');
      try {
        const result = await download(query, true);
        await ctx.sock.sendMessage(ctx.jid, {
          video: result.buffer,
          caption: `🎬 ${label(query)}`,
          mimetype: 'video/mp4',
          fileName: result.name
        }, { quoted: ctx.msg });
        return ctx.react?.('✅');
      } catch (error) {
        return ctx.reply(`Não consegui baixar o vídeo. Use um vídeo de até ${VIDEO_LIMIT}s ou tente outra busca. ${errorText(error)}`);
      }
    }
  }
];
