import { formatMs, formatDate, normalize, parseArgs, randomItem } from '../utils.js';
import { participantLabel } from '../participants.js';

const DAILY_COOLDOWN = 86400000;
const DAILY_XP = 25;

export const ITEMS = [
  { id: 'iniciante', type: 'titulo', name: 'Iniciante', icon: '🌱', price: 100, title: 'Iniciante' },
  { id: 'engracado', type: 'titulo', name: 'Engraçado', icon: '😂', price: 300, title: 'Engraçado' },
  { id: 'mestre', type: 'titulo', name: 'Mestre', icon: '🧠', price: 800, title: 'Mestre' },
  { id: 'lenda', type: 'titulo', name: 'Lenda', icon: '👑', price: 2000, title: 'Lenda' },
  { id: 'pocao', type: 'item', name: 'Poção de cura', icon: '🧪', price: 50, key: 'pocao' },
  { id: 'escudo', type: 'item', name: 'Escudo mágico', icon: '🛡️', price: 90, key: 'escudo' },
  { id: 'amplificador', type: 'item', name: 'Amplificador de XP', icon: '⚡', price: 250, key: 'amplificador' }
];

function findItem(value) {
  const key = normalize(value || '');
  return ITEMS.find((item) => item.id === key || normalize(item.name) === key) || null;
}

function titleOf(user) {
  return user.activeTitle ? ` [${user.activeTitle}]` : '';
}

export function displayName(jid, user, ctx) {
  return `${ctx ? participantLabel(ctx, jid) : `@${String(jid).split('@')[0]}`}${titleOf(user)}`;
}

export const economiaCommands = [
  {
    name: 'carteira',
    aliases: ['saldo', 'coins', 'moedas'],
    category: 'Economia',
    description: 'Ver seu saldo de moedas',
    usage: '!carteira',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      return ctx.reply(
        `💰 *Carteira de @${ctx.sender.split('@')[0]}*\n\n` +
        `Moedas: *${user.coins}*\n` +
        `XP: ${user.xp} (nível ${user.level})\n` +
        `Sequência diária: ${user.streak} dia(s)\n` +
        `Título: ${user.activeTitle || 'nenhum'}\n\n` +
        `Use \`${ctx.prefix}loja\` para gastar suas moedas.`
      );
    }
  },
  {
    name: 'daily',
    aliases: ['diario', 'recompensa'],
    category: 'Economia',
    description: 'Recompensa diária de XP e moedas',
    usage: '!daily',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const now = Date.now();
      const remaining = user.lastDaily + DAILY_COOLDOWN - now;
      if (remaining > 0) {
        return ctx.reply(`Você já resgatou hoje. Volte em ${formatMs(remaining)}.`);
      }
      const streak = now - user.lastDaily < DAILY_COOLDOWN * 2 ? (user.streak || 0) + 1 : 1;
      const reward = Math.min(100, 30 + streak * 10);
      user.streak = streak;
      user.lastDaily = now;
      user.coins += reward;
      const { level, leveledUp } = ctx.store.addXp(ctx.sender, DAILY_XP);
      return ctx.reply(
        `🎁 *Recompensa diária!*\n\n` +
        `+${DAILY_XP} XP e +${reward} moedas\n` +
        `Sequência: *${streak} dia(s)*\n` +
        `Saldo: ${user.coins} moedas | Nível ${level}` +
        (leveledUp ? '\n🎉 Subiu de nível!' : '') +
        `\nPróximo resgate: ${formatDate(new Date(now + DAILY_COOLDOWN), ctx.config.timezone)}`,
        { react: '🎁' }
      );
    }
  },
  {
    name: 'loja',
    aliases: ['shop', 'store'],
    category: 'Economia',
    description: 'Ver itens e títulos à venda',
    usage: '!loja',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const lines = ITEMS.map((item) =>
        `${item.icon} \`${item.id}\` — ${item.name} — *${item.price} moedas*`);
      return ctx.reply(
        `🛒 *Loja* (saldo: ${user.coins} moedas)\n\n${lines.join('\n')}\n\n` +
        `Compre com \`${ctx.prefix}comprar <id>\` (ou \`${ctx.prefix}comprar <id> xp\`) ` +
        `e use títulos com \`${ctx.prefix}titulo <id>\`.`
      );
    }
  },
  {
    name: 'comprar',
    aliases: ['buy'],
    category: 'Economia',
    description: 'Comprar um item ou título',
    usage: '!comprar pocao',
    run(ctx) {
      const item = findItem(ctx.args[0]);
      if (!item) return ctx.reply(`Item não encontrado. Veja \`${ctx.prefix}loja\`.`);
      const user = ctx.store.user(ctx.sender);
      const useXp = normalize(ctx.args[1]) === 'xp';
      if (item.type === 'titulo' && user.titles.includes(item.title)) {
        return ctx.reply('Você já possui esse título.');
      }
      const balance = useXp ? user.xp : user.coins;
      if (balance < item.price) {
        return ctx.reply(`${useXp ? 'XP' : 'Moedas'} insuficiente(s): você tem ${balance} e precisa de ${item.price}.`);
      }
      if (useXp) user.xp -= item.price;
      else ctx.store.spendCoins(ctx.sender, item.price);
      if (item.type === 'titulo') {
        user.titles.push(item.title);
        return ctx.reply(`✅ Título *${item.title}* comprado! Use \`${ctx.prefix}titulo ${item.id}\` para equipar.`);
      }
      user.inventory[item.key] = (user.inventory[item.key] || 0) + 1;
      return ctx.reply(`✅ ${item.name} adicionado ao seu inventário.`);
    }
  },
  {
    name: 'titulo',
    aliases: ['title', 'titulos'],
    category: 'Economia',
    description: 'Equipar um título comprado',
    usage: '!titulo lenda | !titulo none',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const value = normalize(ctx.args.join(' '));
      if (!value || ['none', 'nenhum', 'remover'].includes(value)) {
        user.activeTitle = null;
        return ctx.reply('Título removido.');
      }
      const item = findItem(value);
      const title = item?.title || user.titles.find((entry) => normalize(entry) === value);
      if (!title) return ctx.reply(`Título não encontrado. Seus títulos: ${user.titles.join(', ') || 'nenhum'}.`);
      if (!user.titles.includes(title)) return ctx.reply('Você ainda não comprou esse título.');
      user.activeTitle = title;
      return ctx.reply(`👑 Título *${title}* equipado!`);
    }
  },
  {
    name: 'apostar',
    aliases: ['aposta', 'bet'],
    category: 'Economia',
    description: 'Apostar moedas em cara/coroa',
    usage: '!apostar 50 cara',
    run(ctx) {
      const amount = Number.parseInt(normalize(ctx.args[0]), 10);
      const side = normalize(ctx.args[1]);
      if (!Number.isFinite(amount) || amount < 5 || amount > 500) {
        return ctx.reply('Use: `!apostar <5 a 500> <cara|coroa>`');
      }
      if (!['cara', 'coroa'].includes(side)) return ctx.reply('Escolha cara ou coroa.');
      if (!ctx.store.spendCoins(ctx.sender, amount)) {
        return ctx.reply(`Saldo insuficiente. Você tem ${ctx.store.user(ctx.sender).coins} moedas.`);
      }
      const result = randomItem(['cara', 'coroa']);
      const won = result === side;
      if (won) ctx.store.addCoins(ctx.sender, amount * 2);
      return ctx.reply(
        `🎲 A moeda caiu em *${result}*. ${won ? `Você ganhou *${amount}* moedas!` : 'Você perdeu a aposta.'}\n` +
        `Saldo: ${ctx.store.user(ctx.sender).coins} moedas`,
        { react: won ? '🎉' : '😢' }
      );
    }
  },
  {
    name: 'transferir',
    aliases: ['pagar', 'enviar'],
    category: 'Economia',
    description: 'Transferir moedas para outro usuário',
    usage: '!transferir @user 50',
    run(ctx) {
      const target = parseArgs(ctx.body).find((part) => part.startsWith('@'));
      const amount = Number.parseInt(ctx.args[ctx.args.length - 1], 10);
      if (!target || !Number.isFinite(amount) || amount < 1) {
        return ctx.reply(`Use: \`${ctx.prefix}transferir @usuario 50\``);
      }
      const targetJid = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        `${target.slice(1)}@s.whatsapp.net`;
      if (targetJid === ctx.sender) return ctx.reply('Você não pode transferir para si mesmo.');
      if (!ctx.store.spendCoins(ctx.sender, amount)) return ctx.reply('Saldo insuficiente.');
      ctx.store.addCoins(targetJid, amount);
      return ctx.reply(`💸 Você transferiu *${amount} moedas* para @${targetJid.split('@')[0]}.`, {
        mentions: [targetJid]
      });
    }
  }
];
