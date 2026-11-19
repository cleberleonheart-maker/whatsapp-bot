import os from 'node:os';
import { formatMs, formatDate } from '../utils.js';

const BOX_TOP = '┏╾═╼❋╾═╼⟡╾═╼❋╾═╼┓';
const BOX_HEADER = '┣┄┄┅┄┅┄┅┄┅┄┅┄┄┫';
const BOX_DIVIDER = '┣┄┄┄┄┄┄┄┄┄┄┄┄┄┫';
const BOX_BOTTOM = '┗╾═╼❋╾═╼⟡╾═╼❋╾═╼┛';

const CATEGORY_META = [
  { name: 'Informação', icon: 'ℹ️' },
  { name: 'Diversão', icon: '🎭' },
  { name: 'Jogos', icon: '🎮' },
  { name: 'Economia', icon: '💰' },
  { name: 'Eventos', icon: '🎉' },
  { name: 'RPG', icon: '⚔️' },
  { name: 'Atividade', icon: '📊' },
  { name: 'Mídia', icon: '🎬' },
  { name: 'Utilidades', icon: '🧰' },
  { name: 'Social', icon: '🤝' },
  { name: 'Administração', icon: '🛡️' }
];

function normalizeCategory(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function boldCaps(value = '') {
  return String(value).toUpperCase().split('').map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + code - 65);
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + code - 48);
    return char;
  }).join('');
}

function short(value = '', max = 72) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function categoryMeta(name) {
  return CATEGORY_META.find((entry) => entry.name === name) || { name, icon: '•' };
}

function sortCategories(commands) {
  const present = [...new Set(commands.map((command) => command.category))];
  const known = CATEGORY_META.filter((entry) => present.includes(entry.name)).map((entry) => entry.name);
  const extra = present.filter((name) => !CATEGORY_META.some((entry) => entry.name === name)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...known, ...extra];
}

function sortCommands(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function renderMenu(ctx, title, sections) {
  const now = new Date();
  const timezone = ctx.config.timezone || 'America/Sao_Paulo';
  const date = now.toLocaleDateString('pt-BR', { timeZone: timezone });
  const time = now.toLocaleTimeString('pt-BR', { timeZone: timezone });
  const owner = ctx.config.ownerNumber || '—';

  const lines = [
    BOX_TOP,
    BOX_HEADER,
    `┃ ⟡ ${boldCaps(title)} ⟡ `,
    `┃ 𖦹 ${date} `,
    `┃ 𖦹 ${time} `,
    `┃ 𖦹 Dono: ${owner} `,
    BOX_HEADER
  ];

  for (const section of sections) {
    lines.push(`┃ ❖ ${boldCaps(section.title)} ❖ `);
    lines.push(BOX_DIVIDER);
    for (const item of section.items || []) {
      lines.push(`┃ ⌁ ${short(item.command, 48)}`);
      if (item.description) lines.push(`┃   ↳ ${short(item.description)}`);
      lines.push('┃');
    }
    lines.push(BOX_DIVIDER);
  }

  lines.push(BOX_BOTTOM);
  return lines.join('\n');
}

function overviewMenu(ctx, commands, categories) {
  const items = categories.map((name) => {
    const meta = categoryMeta(name);
    const count = commands.filter((command) => command.category === name).length;
    return {
      command: `${ctx.prefix}ajuda ${name}`,
      description: `${meta.icon} ${name} (${count} comandos)`
    };
  });
  return renderMenu(ctx, ctx.config.botName, [
    { title: 'Menu Principal', items },
    {
      title: 'Sistema',
      items: [
        { command: `${ctx.prefix}ping`, description: 'Testar se o bot está online' },
        { command: `${ctx.prefix}status`, description: 'Estatísticas do bot' },
        { command: `${ctx.prefix}ajuda tudo`, description: 'Lista completa de comandos' }
      ]
    }
  ]);
}

function categoryMenu(ctx, commands, name) {
  const meta = categoryMeta(name);
  const list = sortCommands(commands.filter((command) => command.category === name));
  return renderMenu(ctx, `Menu ${name}`, [
    {
      title: `${meta.icon} ${name}`,
      items: list.map((command) => ({
        command: `${ctx.prefix}${command.name}`,
        description: command.description
      }))
    },
    {
      title: 'Navegação',
      items: [
        { command: `${ctx.prefix}ajuda`, description: 'Voltar ao menu principal' },
        { command: `${ctx.prefix}ajuda tudo`, description: 'Lista completa de comandos' }
      ]
    }
  ]);
}

function fullMenu(ctx, commands, categories) {
  const sections = categories.map((name) => {
    const meta = categoryMeta(name);
    const list = sortCommands(commands.filter((command) => command.category === name));
    return {
      title: `${meta.icon} ${name}`,
      items: list.map((command) => ({
        command: `${ctx.prefix}${command.name}`,
        description: command.description
      }))
    };
  });
  return renderMenu(ctx, 'Todos os Comandos', sections);
}

export const infoCommands = [
  {
    name: 'ajuda',
    aliases: ['help', 'menu', 'comandos', 'start'],
    category: 'Informação',
    description: 'Mostrar todos os comandos',
    usage: '!ajuda [categoria]',
    run(ctx) {
      const commands = ctx.registry || [];
      const categories = sortCategories(commands);
      const raw = String(ctx.text || '').trim();

      if (!raw) return ctx.reply(overviewMenu(ctx, commands, categories));

      if (/^\d+$/.test(raw)) {
        const index = Number(raw) - 1;
        if (!categories[index]) {
          return ctx.reply(`Categoria inválida. Use um número de 1 a ${categories.length}.`);
        }
        return ctx.reply(categoryMenu(ctx, commands, categories[index]));
      }

      const normalized = normalizeCategory(raw);
      if (['tudo', 'todos', 'completo', 'full', 'all'].includes(normalized)) {
        return ctx.reply(fullMenu(ctx, commands, categories));
      }

      const target = categories.find((name) => normalizeCategory(name) === normalized);
      if (!target) {
        return ctx.reply(`Categoria não encontrada. Use: ${ctx.prefix}ajuda\n\nCategorias: ${categories.join(', ')}`);
      }
      return ctx.reply(categoryMenu(ctx, commands, target));
    }
  },
  {
    name: 'infogrupo',
    aliases: ['grupoinfo', 'groupinfo', 'infodogrupo'],
    category: 'Informação',
    description: 'Mostrar informações do grupo',
    usage: '!infogrupo',
    groupOnly: true,
    async run(ctx) {
      let metadata = ctx.groupMetadata;
      if (!metadata && typeof ctx.sock.groupMetadata === 'function') {
        try { metadata = await ctx.sock.groupMetadata(ctx.jid); } catch {}
      }
      if (!metadata) return ctx.reply('Não consegui carregar as informações do grupo.');
      const participants = metadata.participants || [];
      const adminJids = participants.filter((member) => member.admin).map((member) => member.id).slice(0, 12);
      const label = (jid) => `@${String(jid).split('@')[0]}`;
      const created = metadata.creation ? formatDate(new Date(metadata.creation * 1000), ctx.config.timezone) : '—';
      return ctx.reply(
        `ℹ️ *Informações do grupo*\n\n` +
        `📌 Nome: ${metadata.subject || '—'}\n` +
        `📝 Descrição: ${metadata.desc || '—'}\n` +
        `👥 Participantes: ${participants.length}\n` +
        `🛡️ Admins: ${adminJids.length ? adminJids.map(label).join(', ') : '—'}\n` +
        `👑 Dono: ${metadata.owner ? label(metadata.owner) : '—'}\n` +
        `📅 Criado: ${created}`,
        { mentions: [...new Set([...adminJids, metadata.owner].filter(Boolean))] }
      );
    }
  },
  {
    name: 'ping',
    aliases: ['pong', 'latencia'],
    category: 'Informação',
    description: 'Verificar se o bot está online',
    usage: '!ping',
    run(ctx) {
      return ctx.reply('🏓 Pong!', { react: '🏓' });
    }
  },
  {
    name: 'status',
    aliases: ['botinfo', 'info', 'sobre'],
    category: 'Informação',
    description: 'Estatísticas do bot',
    usage: '!status',
    run(ctx) {
      const { store } = ctx;
      const uptime = Date.now() - (store.stats.startedAt || Date.now());
      const ranked = store.ranking(1)[0];
      return ctx.reply(
        `*${ctx.config.botName} — Status*\n\n` +
        `🤖 Versão: 1.0.0\n` +
        `⚡ Uptime: ${formatMs(uptime)}\n` +
        `💬 Mensagens: ${store.stats.messages}\n` +
        `⌨️ Comandos: ${store.stats.commands}\n` +
        `👥 Usuários: ${Object.keys(store.users).length}\n` +
        `🏆 Líder: ${ranked ? `@${ranked[0].split('@')[0]} (${ranked[1].xp} XP)` : '—'}\n` +
        `💻 Node: ${process.version} (${os.platform()}/${os.arch()})\n` +
        `📅 Hoje: ${formatDate(new Date(), ctx.config.timezone)}`
      );
    }
  }
];
