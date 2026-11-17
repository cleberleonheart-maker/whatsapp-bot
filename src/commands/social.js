import { clamp } from '../utils.js';
import { displayName } from './economia.js';

export const socialCommands = [
  {
    name: 'rank',
    aliases: ['ranking', 'top', 'classificacao'],
    category: 'Social',
    description: 'Ranking de XP do bot',
    usage: '!rank',
    run(ctx) {
      const top = ctx.store.ranking(10);
      if (!top.length) return ctx.reply('Ainda não há usuários no ranking.');
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map(([jid, data], index) => {
        const title = data.activeTitle ? ` [${data.activeTitle}]` : '';
        return `${medals[index] || `${index + 1}º`} @${jid.split('@')[0]}${title} — *${data.xp} XP* (nível ${data.level})`;
      });
      return ctx.reply(`🏆 *Ranking*\n\n${lines.join('\n')}`, {
        mentions: top.map(([jid]) => jid)
      });
    }
  },
  {
    name: 'nivel',
    aliases: ['level', 'xp', 'meunivel'],
    category: 'Social',
    description: 'Ver seu nível e progresso',
    usage: '!nivel [@mencionado]',
    run(ctx) {
      const target = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || ctx.sender;
      const user = ctx.store.user(target);
      const current = ctx.store.constructor.xpForLevel(user.level);
      const next = ctx.store.constructor.xpForLevel(user.level + 1);
      const progress = clamp(Math.round(((user.xp - current) / (next - current)) * 100), 0, 100);
      const filled = Math.round(progress / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      return ctx.reply(
        `📊 *Nível de ${displayName(target, user)}*\n\n` +
        `Nível: *${user.level}*\nXP: *${user.xp}*\n` +
        `[${bar}] ${progress}%\n` +
        `Mensagens: ${user.messages} | Vitórias: ${user.wins} | Moedas: ${user.coins}`,
        { mentions: [target] }
      );
    }
  }
];
