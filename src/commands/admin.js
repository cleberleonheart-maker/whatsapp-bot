import { normalize } from '../utils.js';

function toggle(value) {
  const text = normalize(value || '');
  if (['on', '1', 'sim', 'true', 'ativar', 'ligar'].includes(text)) return true;
  if (['off', '0', 'nao', 'não', 'false', 'desativar', 'desligar'].includes(text)) return false;
  return null;
}

function status(value) {
  return value ? '✅ ativado' : '❌ desativado';
}

export const adminCommands = [
  {
    name: 'antilink',
    aliases: ['antilinks'],
    category: 'Administração',
    description: 'Ativar/desativar bloqueio de links',
    usage: '!antilink on|off',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const value = toggle(ctx.args[0]);
      if (value === null) return ctx.reply(`Anti-link está ${status(group.antilink)}. Use on ou off.`);
      group.antilink = value;
      return ctx.reply(`Anti-link ${status(value)}.`);
    }
  },
  {
    name: 'filtro',
    aliases: ['filter', 'palavao'],
    category: 'Administração',
    description: 'Ativar/desativar filtro de palavrões',
    usage: '!filtro on|off',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const value = toggle(ctx.args[0]);
      if (value === null) return ctx.reply(`Filtro está ${status(group.filter)}. Use on ou off.`);
      group.filter = value;
      return ctx.reply(`Filtro de palavrões ${status(value)}.`);
    }
  },
  {
    name: 'boasvindas',
    aliases: ['welcome'],
    category: 'Administração',
    description: 'Configurar mensagem de boas-vindas',
    usage: '!boasvindas on|off|texto',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const value = toggle(ctx.args[0]);
      if (value === null) {
        const custom = ctx.text;
        if (!custom) {
          return ctx.reply(
            `Boas-vindas ${status(group.welcome)}.\nTexto atual: ${group.welcomeText}\n` +
            `Use \`${ctx.prefix}boasvindas on|off\` ou \`${ctx.prefix}boasvindas Seja bem-vindo, @user!\``
          );
        }
        group.welcomeText = custom;
        return ctx.reply(`Mensagem de boas-vindas atualizada para: ${custom}`);
      }
      group.welcome = value;
      return ctx.reply(`Boas-vindas ${status(value)}.`);
    }
  },
  {
    name: 'link',
    aliases: ['grupolink', 'convite'],
    category: 'Administração',
    description: 'Obter o link de convite do grupo',
    usage: '!link',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      if (typeof ctx.sock.groupInviteCode !== 'function') {
        return ctx.reply('Seu cliente Baileys não suporta esta função.');
      }
      try {
        const code = await ctx.sock.groupInviteCode(ctx.jid);
        return ctx.reply(`🔗 Link do grupo: https://chat.whatsapp.com/${code}`);
      } catch {
        return ctx.reply('Não consegui pegar o link. Verifique se o bot é admin do grupo.');
      }
    }
  },
  {
    name: 'kick',
    aliases: ['remover', 'expulsar'],
    category: 'Administração',
    description: 'Remover um membro do grupo (responde à mensagem)',
    usage: '!kick (respondendo à mensagem)',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const target = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return ctx.reply('Responda à mensagem da pessoa que deseja remover.');
      if (typeof ctx.sock.groupParticipantsUpdate !== 'function') {
        return ctx.reply('Seu cliente Baileys não suporta esta função.');
      }
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'remove');
        return ctx.reply(`@${target.split('@')[0]} foi removido do grupo.`, { mentions: [target] });
      } catch {
        return ctx.reply('Não consegui remover esse membro. O bot precisa ser administrador.');
      }
    }
  }
];
