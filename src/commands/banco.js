import { formatMs, formatDate, normalize, randomInt, randomItem } from '../utils.js';

const WORK_COOLDOWN = 180000;
const INVEST_COOLDOWN = 600000;
const INTEREST_PERIOD = 86400000;
const JOBS = ['entregador', 'programador', 'barista', 'mecânico', 'professor', 'designer', 'padeiro'];

function parseAmount(value) {
  const amount = Number.parseInt(normalize(value), 10);
  return Number.isFinite(amount) ? amount : 0;
}

function applyInterest(user) {
  const now = Date.now();
  if (!(user.bank > 0) || !user.bankInterestAt) return 0;
  const days = Math.min(7, Math.floor((now - user.bankInterestAt) / INTEREST_PERIOD));
  if (days <= 0) return 0;
  const interest = Math.floor(user.bank * 0.01 * days);
  user.bank += interest;
  user.bankInterestAt = now;
  return interest;
}

export const bancoCommands = [
  {
    name: 'banco',
    aliases: ['bank', 'conta'],
    category: 'Economia',
    description: 'Ver carteira, banco, juros e impostos',
    usage: '!banco',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const interest = applyInterest(user);
      const nextInterest = new Date((user.bankInterestAt || Date.now()) + INTEREST_PERIOD);
      return ctx.reply(
        `🏦 *Banco de @${ctx.sender.split('@')[0]}*\n\n` +
        `Carteira: *${user.coins}* moedas\n` +
        `Banco: *${user.bank || 0}* moedas\n` +
        `Juros recebidos: ${interest ? `*+${interest}*` : '—'}\n` +
        `Imposto pendente: *${user.taxDebt || 0}* moedas\n\n` +
        `Depositar: \`${ctx.prefix}depositar <valor>\`\n` +
        `Sacar: \`${ctx.prefix}sacar <valor>\`\n` +
        `Próximos juros: ${formatDate(nextInterest, ctx.config.timezone)}`,
        { react: '🏦' }
      );
    }
  },
  {
    name: 'depositar',
    aliases: ['dep', 'guardar'],
    category: 'Economia',
    description: 'Guardar moedas no banco',
    usage: '!depositar 100',
    run(ctx) {
      const amount = parseAmount(ctx.args[0]);
      if (amount < 1) return ctx.reply(`Use: \`${ctx.prefix}depositar <valor>\`.`);
      if (!ctx.store.depositCoins(ctx.sender, amount)) {
        return ctx.reply(`Saldo insuficiente. Você tem ${ctx.store.user(ctx.sender).coins} moedas.`);
      }
      const user = ctx.store.user(ctx.sender);
      return ctx.reply(`🏦 Você depositou *${amount} moedas*. Saldo bancário: *${user.bank}*.`);
    }
  },
  {
    name: 'sacar',
    aliases: ['saque', 'retirar'],
    category: 'Economia',
    description: 'Retirar moedas do banco',
    usage: '!sacar 100',
    run(ctx) {
      const amount = parseAmount(ctx.args[0]);
      if (amount < 1) return ctx.reply(`Use: \`${ctx.prefix}sacar <valor>\`.`);
      if (!ctx.store.withdrawCoins(ctx.sender, amount)) {
        return ctx.reply(`Saldo bancário insuficiente. Você tem ${ctx.store.user(ctx.sender).bank || 0} moedas no banco.`);
      }
      const user = ctx.store.user(ctx.sender);
      return ctx.reply(`💸 Você sacou *${amount} moedas*. Carteira: *${user.coins}*.`);
    }
  },
  {
    name: 'trabalho',
    aliases: ['trabalhar', 'job'],
    category: 'Economia',
    description: 'Trabalhar para ganhar moedas',
    usage: '!trabalho',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const now = Date.now();
      const remaining = (user.workAt || 0) + WORK_COOLDOWN - now;
      if (remaining > 0) return ctx.reply(`😴 Você precisa descansar. Volte em ${formatMs(remaining)}.`);

      const job = randomItem(JOBS);
      const bonusEvent = randomInt(1, 12) === 1;
      const gross = randomInt(20, 50) + Math.min(30, user.level * 3) + (bonusEvent ? randomInt(30, 60) : 0);
      let net = gross - Math.floor(gross * 0.1);
      const latePenalty = (user.taxDebt || 0) > 0;
      if (latePenalty) net = Math.floor(net * 0.8);
      ctx.store.addCoins(ctx.sender, net);
      ctx.store.addTaxDebt(ctx.sender, Math.floor(gross * 0.1));
      user.workAt = now;
      user.jobs = (user.jobs || 0) + 1;
      ctx.store.trackEvent?.('trabalho', 1);

      return ctx.reply(
        `💼 Você trabalhou como *${job}* e recebeu *${net} moedas*.\n` +
        `Bruto: ${gross} | Imposto retido: ${Math.floor(gross * 0.1)}${latePenalty ? ' | Multa por atraso: 20%' : ''}` +
        `${bonusEvent ? '\n✨ Você fez um serviço extra e ganhou um bônus!' : ''}\n` +
        `Use \`${ctx.prefix}imposto pagar\` para ficar em dia.`,
        { react: '💼' }
      );
    }
  },
  {
    name: 'investir',
    aliases: ['investimento', 'invest'],
    category: 'Economia',
    description: 'Investir moedas com risco de lucro ou prejuízo',
    usage: '!investir 100',
    run(ctx) {
      const amount = parseAmount(ctx.args[0]);
      if (amount < 10 || amount > 500) return ctx.reply(`Use: \`${ctx.prefix}investir <10 a 500>\`.`);
      const user = ctx.store.user(ctx.sender);
      const now = Date.now();
      const remaining = (user.investAt || 0) + INVEST_COOLDOWN - now;
      if (remaining > 0) return ctx.reply(`📊 Aguarde ${formatMs(remaining)} para investir de novo.`);
      if (!ctx.store.spendCoins(ctx.sender, amount)) {
        return ctx.reply(`Saldo insuficiente. Você tem ${user.coins} moedas.`);
      }

      const profit = Math.random() < 0.6;
      const rate = profit ? randomInt(20, 60) / 100 : -randomInt(10, 30) / 100;
      const result = Math.max(1, Math.floor(amount * (1 + rate)));
      const difference = result - amount;
      let tax = 0;
      if (difference > 0) {
        tax = Math.floor(difference * 0.1);
        ctx.store.addCoins(ctx.sender, result);
        ctx.store.addTaxDebt(ctx.sender, tax);
      } else {
        ctx.store.addCoins(ctx.sender, result);
      }
      user.investAt = now;
      user.investments = (user.investments || 0) + 1;
      ctx.store.trackEvent?.('investimentos', 1);

      return ctx.reply(
        `${profit ? '📈' : '📉'} *Investimento ${profit ? 'lucrativo' : 'com prejuízo'}*\n\n` +
        `Aplicado: ${amount} moedas\n` +
        `Retorno: ${result} moedas (${difference >= 0 ? '+' : ''}${difference})\n` +
        `${tax ? `Imposto sobre o lucro: ${tax} moedas\n` : ''}` +
        `Saldo: ${ctx.store.user(ctx.sender).coins} moedas`,
        { react: profit ? '📈' : '📉' }
      );
    }
  },
  {
    name: 'imposto',
    aliases: ['impostos', 'pagarimposto'],
    category: 'Economia',
    description: 'Consultar ou pagar impostos pendentes',
    usage: '!imposto pagar',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      if (normalize(ctx.args[0]) === 'pagar') {
        const debt = user.taxDebt || 0;
        if (debt <= 0) return ctx.reply('✅ Você não tem impostos pendentes.');
        if (!ctx.store.payTax(ctx.sender)) {
          return ctx.reply(`Você precisa de *${debt} moedas* para pagar o imposto. Carteira: ${user.coins}.`);
        }
        ctx.store.addXp(ctx.sender, 10);
        return ctx.reply(`🧾 Imposto de *${debt} moedas* pago! +10 XP e multa removida.`, { react: '✅' });
      }
      const debt = user.taxDebt || 0;
      return ctx.reply(
        `🧾 *Situação fiscal*\n\n` +
        `Imposto pendente: *${debt} moedas*\n` +
        `Carteira: ${user.coins} moedas\n` +
        `Pagamentos: ${user.taxesPaid || 0}\n\n` +
        `Com dívida ativa, o trabalho rende 20% menos.\n` +
        `Pague com \`${ctx.prefix}imposto pagar\`.`
      );
    }
  }
];
