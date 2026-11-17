const MEDALS = ['🥇', '🥈', '🥉'];

function number(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function label(entry) {
  return entry.name || `@${String(entry.userId).split('@')[0]}`;
}

export const activityCommands = [
  {
    name: 'rankativo',
    aliases: ['topativos', 'rankingatividade', 'maisativos'],
    category: 'Atividade',
    description: 'Ranking dos membros mais ativos do grupo',
    usage: '!rankativo',
    groupOnly: true,
    run(ctx) {
      if (typeof ctx.store.activityRanking !== 'function') {
        return ctx.reply('Este recurso não está disponível no momento.');
      }
      const ranking = ctx.store.activityRanking(ctx.jid, 10);
      if (!ranking.length) return ctx.reply('Ainda não há atividade registrada neste grupo.');
      const lines = ranking.map((entry, index) => {
        const medal = MEDALS[index] || `${index + 1}.`;
        return `${medal} ${label(entry)} — ${entry.total} ações (${entry.messages} msg, ${entry.commands} cmd)`;
      });
      return ctx.reply(`🏆 *Membros mais ativos*\n\n${lines.join('\n')}`);
    }
  },
  {
    name: 'inativos',
    aliases: ['inativos5', 'membrosinativos'],
    category: 'Atividade',
    description: 'Listar membros com pouca ou nenhuma atividade',
    usage: '!inativos [mínimo]',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      if (typeof ctx.store.inactiveMembers !== 'function') {
        return ctx.reply('Este recurso não está disponível no momento.');
      }
      const threshold = Math.min(100, Math.max(1, number(ctx.args[0], 5)));
      const members = ctx.store.inactiveMembers(ctx.jid, ctx.groupMembers || ctx.groupMetadata?.participants || [], threshold);
      if (!members.length) return ctx.reply('Nenhum membro abaixo desse limite.');
      const lines = members.slice(0, 30).map((member) => `• @${String(member.id).split('@')[0]}`);
      const extra = members.length > 30 ? `\n\n… e mais ${members.length - 30} membro(s).` : '';
      return ctx.reply(
        `😴 *Membros com menos de ${threshold} ações*\n\n${lines.join('\n')}${extra}`,
        { mentions: members.slice(0, 30).map((member) => member.id) }
      );
    }
  }
];
