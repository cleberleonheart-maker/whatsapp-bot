import fs from 'node:fs';
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

function targetFrom(ctx) {
  const info = ctx.msg.message?.extendedTextMessage?.contextInfo || {};
  return info.participant || info.mentionedJid?.[0] || ctx.args.find((arg) => arg.includes('@')) || '';
}

function mention(target) {
  return `@${String(target).split('@')[0]}`;
}

function listMembers(ctx) {
  return ctx.groupMembers || ctx.groupMetadata?.participants || [];
}

function restAfterAction(ctx) {
  return String(ctx.text || '').replace(/^\S+\s*/, '').trim();
}

export const moderationCommands = [
  {
    name: 'autoresposta',
    aliases: ['autoresp', 'respostaautomatica'],
    category: 'Administração',
    description: 'Respostas automáticas por palavra-chave',
    usage: '!autoresposta on|off | add gatilho|resposta | del gatilho | list',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      group.autoResponseEnabled = group.autoResponseEnabled !== undefined ? group.autoResponseEnabled : false;
      group.autoResponses = group.autoResponses || [];
      const [action, ...rest] = ctx.args;
      const value = toggle(action);
      if (value !== null) {
        group.autoResponseEnabled = value;
        return ctx.reply(`Respostas automáticas ${status(value)}.`);
      }
      if (!action || action === 'list') {
        const lines = group.autoResponses.map((entry, index) => `${index + 1}. \`${entry.trigger}\` → ${entry.response}`);
        return ctx.reply(
          `Respostas automáticas ${status(group.autoResponseEnabled)}.\n` +
          (lines.length ? lines.join('\n') : 'Nenhuma resposta cadastrada.') +
          `\n\nUse \`${ctx.prefix}autoresposta add oi|Olá!\``
        );
      }
      if (action === 'add') {
        const payload = rest.join(' ');
        const separator = payload.indexOf('|');
        if (separator < 1 || separator === payload.length - 1) {
          return ctx.reply(`Use: \`${ctx.prefix}autoresposta add gatilho|resposta\``);
        }
        const trigger = payload.slice(0, separator).trim();
        const response = payload.slice(separator + 1).trim();
        group.autoResponses.push({ trigger, response });
        return ctx.reply(`Resposta automática adicionada para \`${trigger}\`.`);
      }
      if (action === 'del' || action === 'rem') {
        const needle = normalize(rest.join(' '));
        const index = group.autoResponses.findIndex((entry) => normalize(entry.trigger) === needle);
        if (index < 0) return ctx.reply('Gatilho não encontrado.');
        const [removed] = group.autoResponses.splice(index, 1);
        return ctx.reply(`Resposta de \`${removed.trigger}\` removida.`);
      }
      return ctx.reply('Ação inválida. Use on, off, add, del ou list.');
    }
  },
  {
    name: 'autofigu',
    aliases: ['autofiguradinha', 'figautomatica'],
    category: 'Administração',
    description: 'Transformar imagens do grupo em figurinhas automaticamente',
    usage: '!autofigu on|off',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const value = toggle(ctx.args[0]);
      if (value === null) return ctx.reply(`Autofigu está ${status(group.autofigu)}. Use on ou off.`);
      group.autofigu = value;
      return ctx.reply(`Autofigu ${status(value)}.`);
    }
  },
  {
    name: 'mute',
    aliases: ['silenciar'],
    category: 'Administração',
    description: 'Silenciar um membro no grupo',
    usage: '!mute (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja silenciar.');
      const group = ctx.store.group(ctx.jid);
      group.muted = group.muted || [];
      if (!group.muted.includes(target)) group.muted.push(target);
      return ctx.reply(`${mention(target)} foi silenciado(a).`, { mentions: [target] });
    }
  },
  {
    name: 'unmute',
    aliases: ['dessilenciar'],
    category: 'Administração',
    description: 'Remover o silenciamento de um membro',
    usage: '!unmute (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja liberar.');
      const group = ctx.store.group(ctx.jid);
      group.muted = (group.muted || []).filter((jid) => jid !== target);
      return ctx.reply(`${mention(target)} foi liberado(a).`, { mentions: [target] });
    }
  },
  {
    name: 'advertir',
    aliases: ['avisar', 'warn'],
    category: 'Administração',
    description: 'Registrar uma advertência para o membro',
    usage: '!advertir (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja advertir.');
      const group = ctx.store.group(ctx.jid);
      group.warnings = group.warnings || {};
      group.warnings[target] = (group.warnings[target] || 0) + 1;
      return ctx.reply(`${mention(target)} recebeu uma advertência (${group.warnings[target]} no total).`, { mentions: [target] });
    }
  },
  {
    name: 'tiraradvertencia',
    aliases: ['unwarn', 'removeradvertencia'],
    category: 'Administração',
    description: 'Remover uma advertência do membro',
    usage: '!tiraradvertencia (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja liberar.');
      const group = ctx.store.group(ctx.jid);
      group.warnings = group.warnings || {};
      const current = group.warnings[target] || 0;
      if (!current) return ctx.reply(`${mention(target)} não tem advertências.`, { mentions: [target] });
      group.warnings[target] = current - 1;
      return ctx.reply(`${mention(target)} agora tem ${group.warnings[target]} advertência(s).`, { mentions: [target] });
    }
  },
  {
    name: 'advertencias',
    aliases: ['avisos', 'warnings', 'warnlist'],
    category: 'Administração',
    description: 'Listar advertências registradas no grupo',
    usage: '!advertencias',
    groupOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const entries = Object.entries(group.warnings || {}).filter(([, count]) => count > 0);
      if (!ctx.isAdmin && !ctx.isOwner) {
        const own = entries.find(([jid]) => jid === ctx.sender);
        if (!own) return ctx.reply('Você não tem advertências registradas.');
        return ctx.reply(`⚠️ Você tem ${own[1]} advertência(s).`);
      }
      if (!entries.length) return ctx.reply('Nenhuma advertência registrada neste grupo.');
      return ctx.reply(`⚠️ *Advertências do grupo*\n\n${entries.map(([jid, count], index) => `${index + 1}. ${mention(jid)} — ${count}`).join('\n')}`, {
        mentions: entries.map(([jid]) => jid)
      });
    }
  },
  {
    name: 'regras',
    aliases: ['regra', 'rules'],
    category: 'Administração',
    description: 'Listar ou editar as regras do grupo',
    usage: '!regras | !regras add texto | !regras del número',
    groupOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      group.rules = group.rules || [];
      const action = normalize(ctx.args[0] || 'list');
      if (action === 'list') {
        if (!group.rules.length) return ctx.reply('Este grupo ainda não tem regras cadastradas.');
        return ctx.reply(`📜 *Regras do grupo*\n\n${group.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`);
      }
      if (!ctx.isAdmin && !ctx.isOwner) return ctx.reply('Apenas administradores podem editar as regras.');
      if (action === 'add' || action === 'set') {
        const rule = restAfterAction(ctx).slice(0, 300);
        if (!rule) return ctx.reply('Informe o texto da regra.');
        group.rules.push(rule);
        return ctx.reply(`Regra ${group.rules.length} adicionada.`);
      }
      if (action === 'del' || action === 'remove') {
        const index = Number(ctx.args[1]) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= group.rules.length) return ctx.reply('Número de regra inválido.');
        const [removed] = group.rules.splice(index, 1);
        return ctx.reply(`Regra removida: ${removed}`);
      }
      if (action === 'clear') {
        group.rules = [];
        return ctx.reply('Regras apagadas.');
      }
      return ctx.reply(`Use: \`${ctx.prefix}regras\`, \`${ctx.prefix}regras add texto\` ou \`${ctx.prefix}regras del número\`.`);
    }
  },
  {
    name: 'palavrao',
    aliases: ['palavroes', 'palavrasproibidas', 'customwords'],
    category: 'Administração',
    description: 'Gerenciar palavras proibidas personalizadas',
    usage: '!palavrao add palavra | !palavrao del palavra | !palavrao list',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      group.customBadWords = group.customBadWords || [];
      const action = normalize(ctx.args[0] || 'list');
      if (action === 'list') {
        const words = group.customBadWords;
        return ctx.reply(
          `🚫 Palavras personalizadas (${words.length})\nFiltro: ${status(group.filter)}` +
          (words.length ? `\n\n${words.map((word, index) => `${index + 1}. ${word}`).join('\n')}` : '')
        );
      }
      const word = restAfterAction(ctx).toLocaleLowerCase('pt-BR').slice(0, 60);
      if (action === 'add') {
        if (!word) return ctx.reply('Informe a palavra ou expressão.');
        if (group.customBadWords.includes(word)) return ctx.reply('Essa palavra já está na lista.');
        group.customBadWords.push(word);
        return ctx.reply(`Palavra adicionada: ${word}`);
      }
      if (action === 'del') {
        const index = group.customBadWords.indexOf(word);
        if (index < 0) return ctx.reply('Palavra não encontrada.');
        group.customBadWords.splice(index, 1);
        return ctx.reply(`Palavra removida: ${word}`);
      }
      if (action === 'clear') {
        group.customBadWords = [];
        return ctx.reply('Lista de palavras personalizadas apagada.');
      }
      return ctx.reply(`Use: \`${ctx.prefix}palavrao add palavra\`, \`${ctx.prefix}palavrao del palavra\` ou \`${ctx.prefix}palavrao list\`.`);
    }
  },
  {
    name: 'blacklist',
    aliases: ['listanegra', 'banlist'],
    category: 'Administração',
    description: 'Gerenciar a lista negra do grupo',
    usage: '!blacklist add|del|list (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      group.blacklist = group.blacklist || [];
      const action = normalize(ctx.args[0] || 'list');
      if (action === 'list') {
        const lines = group.blacklist.map((jid, index) => `${index + 1}. ${mention(jid)}`);
        return ctx.reply(lines.length ? `*Lista negra*\n${lines.join('\n')}` : 'Lista negra vazia.');
      }
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione o membro.');
      if (action === 'add' || action === 'ban') {
        if (!group.blacklist.includes(target)) group.blacklist.push(target);
        return ctx.reply(`${mention(target)} entrou na lista negra.`, { mentions: [target] });
      }
      if (action === 'del' || action === 'rem' || action === 'unban') {
        group.blacklist = group.blacklist.filter((jid) => jid !== target);
        return ctx.reply(`${mention(target)} saiu da lista negra.`, { mentions: [target] });
      }
      return ctx.reply('Ação inválida. Use add, del ou list.');
    }
  },
  {
    name: 'promover',
    aliases: ['promote'],
    category: 'Administração',
    description: 'Promover membro a administrador',
    usage: '!promover (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja promover.');
      if (typeof ctx.sock.groupParticipantsUpdate !== 'function') {
        return ctx.reply('Seu cliente Baileys não suporta esta função.');
      }
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'promote');
        return ctx.reply(`${mention(target)} foi promovido(a).`, { mentions: [target] });
      } catch {
        return ctx.reply('Não consegui promover esse membro. Verifique as permissões do bot.');
      }
    }
  },
  {
    name: 'rebaixar',
    aliases: ['demote', 'rebaixaradmin'],
    category: 'Administração',
    description: 'Remover a administração de um membro',
    usage: '!rebaixar (respondendo ou mencionando)',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const target = targetFrom(ctx);
      if (!target) return ctx.reply('Responda ou mencione quem deseja rebaixar.');
      if (typeof ctx.sock.groupParticipantsUpdate !== 'function') {
        return ctx.reply('Seu cliente Baileys não suporta esta função.');
      }
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [target], 'demote');
        return ctx.reply(`${mention(target)} foi rebaixado(a).`, { mentions: [target] });
      } catch {
        return ctx.reply('Não consegui rebaixar esse membro. Verifique as permissões do bot.');
      }
    }
  },
  {
    name: 'fixar',
    aliases: ['pin', 'fixarmensagem'],
    category: 'Administração',
    description: 'Fixar a mensagem respondida',
    usage: '!fixar (respondendo à mensagem)',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const info = ctx.msg.message?.extendedTextMessage?.contextInfo || {};
      if (!info.quotedMessage || !info.stanzaId) {
        return ctx.reply('Responda à mensagem que deseja fixar.');
      }
      try {
        await ctx.sock.sendMessage(ctx.jid, {
          pin: { remoteJid: ctx.jid, id: info.stanzaId, fromMe: false, participant: info.participant },
          type: 1
        });
        return ctx.reply('📌 Mensagem fixada.');
      } catch {
        return ctx.reply('Não consegui fixar essa mensagem.');
      }
    }
  },
  {
    name: 'desfixar',
    aliases: ['unpin', 'desfixarmensagem'],
    category: 'Administração',
    description: 'Desfixar a mensagem respondida',
    usage: '!desfixar (respondendo à mensagem)',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const info = ctx.msg.message?.extendedTextMessage?.contextInfo || {};
      if (!info.quotedMessage || !info.stanzaId) {
        return ctx.reply('Responda à mensagem que deseja desfixar.');
      }
      try {
        await ctx.sock.sendMessage(ctx.jid, {
          pin: { remoteJid: ctx.jid, id: info.stanzaId, fromMe: false, participant: info.participant },
          type: 2
        });
        return ctx.reply('📌 Mensagem desfixada.');
      } catch {
        return ctx.reply('Não consegui desfixar essa mensagem.');
      }
    }
  },
  {
    name: 'marcar',
    aliases: ['everyone', 'todos'],
    category: 'Administração',
    description: 'Marcar todos os membros do grupo',
    usage: '!marcar [mensagem]',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const mentions = listMembers(ctx).map((member) => member.id).filter(Boolean);
      if (!mentions.length) return ctx.reply('Não consegui obter a lista de membros.');
      const text = ctx.text || '📢 Atenção, todos!';
      await ctx.sock.sendMessage(ctx.jid, { text }, { mentions });
      return ctx.react?.('📢');
    }
  },
  {
    name: 'hidetag',
    aliases: ['marcaroculto'],
    category: 'Administração',
    description: 'Marcar todos sem mostrar os nomes',
    usage: '!hidetag [mensagem]',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const mentions = listMembers(ctx).map((member) => member.id).filter(Boolean);
      if (!mentions.length) return ctx.reply('Não consegui obter a lista de membros.');
      const text = ctx.text || '📢';
      await ctx.sock.sendMessage(ctx.jid, { text }, { mentions });
      return ctx.react?.('📢');
    }
  },
  {
    name: 'dominios',
    aliases: ['dominiosliberados', 'allowdomain'],
    category: 'Administração',
    description: 'Domínios liberados do anti-link',
    usage: '!dominios add exemplo.com | del exemplo.com | list',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      group.allowedDomains = group.allowedDomains || [];
      const [action, ...rest] = ctx.args;
      if (!action || action === 'list') {
        return ctx.reply(group.allowedDomains.length ? `Domínios liberados: ${group.allowedDomains.join(', ')}` : 'Nenhum domínio liberado.');
      }
      const domain = rest.join(' ').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!domain) return ctx.reply('Informe o domínio.');
      if (action === 'add') {
        if (!group.allowedDomains.includes(domain)) group.allowedDomains.push(domain);
        return ctx.reply(`Domínio \`${domain}\` liberado.`);
      }
      if (action === 'del' || action === 'rem') {
        group.allowedDomains = group.allowedDomains.filter((value) => value !== domain);
        return ctx.reply(`Domínio \`${domain}\` removido.`);
      }
      return ctx.reply('Ação inválida. Use add, del ou list.');
    }
  },
  {
    name: 'cooldown',
    aliases: ['intervalo'],
    category: 'Administração',
    description: 'Definir o intervalo entre comandos no grupo',
    usage: '!cooldown 2500 (milissegundos)',
    groupOnly: true,
    adminOnly: true,
    run(ctx) {
      const group = ctx.store.group(ctx.jid);
      const value = Number.parseInt(ctx.args[0], 10);
      if (!Number.isFinite(value)) {
        return ctx.reply(`Cooldown atual: ${Number(group.cooldown) || 0}ms. Use \`${ctx.prefix}cooldown 2000\`.`);
      }
      group.cooldown = Math.min(60000, Math.max(500, value));
      return ctx.reply(`Cooldown definido para ${group.cooldown}ms.`);
    }
  },
  {
    name: 'backup',
    aliases: ['backupdados'],
    category: 'Administração',
    description: 'Enviar os arquivos de dados do bot',
    usage: '!backup',
    ownerOnly: true,
    async run(ctx) {
      const files = [
        ['users.json', ctx.store.usersFile],
        ['groups.json', ctx.store.groupsFile],
        ['activity.json', ctx.store.activityFile],
        ['stats.json', ctx.store.statsFile]
      ].filter(([, file]) => file && fs.existsSync(file));
      if (!files.length) return ctx.reply('Nenhum arquivo de dados encontrado.');
      for (const [name, file] of files) {
        await ctx.sock.sendMessage(ctx.jid, {
          document: fs.readFileSync(file),
          fileName: name,
          mimetype: 'application/json'
        });
      }
      return ctx.reply(`Backup enviado: ${files.map(([name]) => name).join(', ')}`);
    }
  }
];
