import { formatDate, formatNumber, normalize, weekInfo } from '../utils.js';
import { participantLabel } from '../participants.js';

export const EVENTS = [
  {
    id: 'economia',
    name: 'Semana da Economia',
    icon: '💰',
    goal: 5000,
    reward: 200,
    hint: 'Ganhe moedas com daily, trabalhos, batalhas e missões.'
  },
  {
    id: 'trabalho',
    name: 'Semana do Trabalho',
    icon: '💼',
    goal: 40,
    reward: 160,
    hint: 'Use `!trabalho` para somar progresso.'
  },
  {
    id: 'missoes',
    name: 'Semana das Missões',
    icon: '📜',
    goal: 30,
    reward: 150,
    hint: 'Resgate missões diárias com `!missoes resgatar`.'
  },
  {
    id: 'investimentos',
    name: 'Semana dos Investimentos',
    icon: '📊',
    goal: 25,
    reward: 150,
    hint: 'Use `!investir <valor>` para somar progresso.'
  },
  {
    id: 'vitorias',
    name: 'Semana das Batalhas',
    icon: '⚔️',
    goal: 20,
    reward: 180,
    hint: 'Vença batalhas no RPG com `!batalha`.'
  }
];

const MEDALS = ['🥇', '🥈', '🥉'];

export function weekState(date = new Date()) {
  const info = weekInfo(date);
  return {
    ...info,
    event: EVENTS[info.week % EVENTS.length],
    nextEvent: EVENTS[(info.week + 1) % EVENTS.length]
  };
}

function progressBar(progress, goal, size = 10) {
  const filled = Math.min(size, Math.floor((progress / goal) * size));
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

function bonusFor(position) {
  if (position === 1) return { multiplier: 1.5, label: '🥇 +50%' };
  if (position === 2) return { multiplier: 1.25, label: '🥈 +25%' };
  if (position === 3) return { multiplier: 1.1, label: '🥉 +10%' };
  return { multiplier: 1, label: 'sem bônus' };
}

export const eventoCommands = [
  {
    name: 'evento',
    aliases: ['eventos', 'eventsemanal'],
    category: 'Eventos',
    description: 'Ver o evento semanal e resgatar a recompensa',
    usage: '!evento | !evento resgatar',
    run(ctx) {
      const { event, nextEvent, next } = weekState();
      const state = ctx.store.eventState();
      const progress = state.counters[event.id] || 0;
      const claimed = state.claimed.includes(ctx.sender);

      if (normalize(ctx.args[0]) === 'resgatar') {
        if (claimed) return ctx.reply('Você já resgatou a recompensa deste evento.');
        if (progress < event.goal) {
          return ctx.reply(`Ainda faltam ${formatNumber(event.goal - progress)} para concluir o evento.`);
        }
        if (!ctx.store.markEventClaimed(ctx.sender)) return ctx.reply('Recompensa já resgatada.');
        const position = ctx.store.economyPosition(ctx.sender);
        const bonus = bonusFor(position);
        const reward = Math.floor(event.reward * bonus.multiplier);
        ctx.store.addCoins(ctx.sender, reward);
        const { level, leveledUp } = ctx.store.addXp(ctx.sender, 40);
        return ctx.reply(
          `🎉 *Evento concluído!*\n\n` +
          `Recompensa: *${formatNumber(reward)} moedas* (${bonus.label})\n` +
          `Sua posição no ranking: *#${position}*\n` +
          `+40 XP | Nível ${level}${leveledUp ? ' 🎉' : ''}\n` +
          `Saldo: ${formatNumber(ctx.store.user(ctx.sender).coins)} moedas`,
          { react: '🎉' }
        );
      }

      const position = ctx.store.economyPosition(ctx.sender);
      const bonus = bonusFor(position);
      return ctx.reply(
        `${event.icon} *${event.name}* \`${weekState().key}\`\n\n` +
        `${progressBar(progress, event.goal)} ${formatNumber(progress)}/${formatNumber(event.goal)}\n` +
        `${event.hint}\n\n` +
        `Recompensa base: *${formatNumber(event.reward)} moedas* + 40 XP\n` +
        `Seu bônus: *${bonus.label}* (#${position} no ranking)\n` +
        `Resgatado: ${claimed ? '✅' : progress >= event.goal ? '🎁 `!evento resgatar`' : '⏳'}\n\n` +
        `Próximo: ${nextEvent.icon} ${nextEvent.name}\n` +
        `Novo evento em ${formatDate(next, ctx.config.timezone)}`,
        { react: event.icon }
      );
    }
  },
  {
    name: 'economiarank',
    aliases: ['rankeconomia', 'ricos', 'topmoedas'],
    category: 'Eventos',
    description: 'Ranking de economia com bônus para o top 3',
    usage: '!economiarank',
    run(ctx) {
      const ranking = ctx.store.economyRanking(10);
      if (!ranking.length) return ctx.reply('Ainda não há usuários no ranking.');
      const lines = ranking.map((entry, index) => {
        const medal = MEDALS[index] || `${index + 1}.`;
        const parts = [
          `${formatNumber(entry.coins)} carteira`,
          `${formatNumber(entry.bank)} banco`
        ];
        if (entry.debt) parts.push(`-${formatNumber(entry.debt)} imposto`);
        return `${medal} ${participantLabel(ctx, entry.jid)} — *${formatNumber(entry.total)}* (${parts.join(', ')})`;
      });
      const position = ctx.store.economyPosition(ctx.sender);
      return ctx.reply(
        `🏆 *Ranking de economia*\n\n${lines.join('\n')}\n\n` +
        `Sua posição: *#${position}*\n` +
        `Bônus de evento: 🥇 +50% | 🥈 +25% | 🥉 +10%\n` +
        `Patrimônio = carteira + banco - imposto pendente.`,
        { react: '🏆' }
      );
    }
  }
];
