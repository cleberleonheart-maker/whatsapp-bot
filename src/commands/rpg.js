import { randomInt, randomItem, normalize, formatMs } from '../utils.js';

const CLASSES = {
  guerreiro: { name: 'Guerreiro', icon: '⚔️', hp: 42, atk: 8, def: 5 },
  mago: { name: 'Mago', icon: '🔮', hp: 28, atk: 13, def: 2 },
  arqueiro: { name: 'Arqueiro', icon: '🏹', hp: 33, atk: 10, def: 3 }
};

const MONSTERS = [
  { name: 'Slime', emoji: '🟢', hp: 18, atk: 5, def: 1, reward: 15, xp: 12 },
  { name: 'Lobo', emoji: '🐺', hp: 26, atk: 8, def: 2, reward: 25, xp: 18 },
  { name: 'Esqueleto', emoji: '💀', hp: 32, atk: 9, def: 3, reward: 35, xp: 24 },
  { name: 'Goblin', emoji: '👺', hp: 28, atk: 10, def: 2, reward: 30, xp: 20 }
];

const BOSS = { name: 'Dragão Ancião', emoji: '🐉', hp: 85, atk: 14, def: 5, reward: 200, xp: 100, boss: true };

const MISSIONS = [
  { id: 'mensagens', name: 'Enviar 10 mensagens', icon: '💬', goal: 10, reward: 40, field: 'messages' },
  { id: 'comandos', name: 'Usar 5 comandos', icon: '⌨️', goal: 5, reward: 30, field: 'commands' },
  { id: 'vitorias', name: 'Vencer 1 batalha', icon: '⚔️', goal: 1, reward: 60, field: 'wins' },
  { id: 'trabalhos', name: 'Trabalhar 1 vez', icon: '💼', goal: 1, reward: 50, field: 'jobs' },
  { id: 'investimentos', name: 'Fazer 1 investimento', icon: '📊', goal: 1, reward: 40, field: 'investments' },
  { id: 'impostos', name: 'Pagar imposto', icon: '🧾', goal: 1, reward: 35, field: 'taxesPaid' }
];

function keyFor(ctx) {
  return `${ctx.jid}:${ctx.sender}:rpg`;
}

function getCharacter(ctx) {
  const user = ctx.store.user(ctx.sender);
  if (!user.rpg) return null;
  return user.rpg;
}

function ctxLevel(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

function characterSheet(ctx, character) {
  const info = CLASSES[character.class];
  const user = ctx.store.user(ctx.sender);
  return `${info.icon} *${info.name}* — nível ${character.level}\n` +
    `❤️ HP: ${character.hp}/${character.maxHp}\n` +
    `⚔️ Ataque: ${character.atk} | 🛡️ Defesa: ${character.def}\n` +
    `🏆 Vitórias: ${character.wins} | 💀 Derrotas: ${character.losses}\n` +
    `💰 Moedas: ${user.coins} | 🎖️ XP de herói: ${character.xp}`;
}

function battleStatus(session) {
  const enemy = session.enemy;
  return `${enemy.emoji} *${enemy.name}* ❤️ ${enemy.hp}/${enemy.maxHp}\n` +
    `🛡️ Defesa: ${enemy.def} | ⚔️ Ataque: ${enemy.atk}\n\n` +
    `Use: \`${session.prefix}atacar\`, \`${session.prefix}defender\`, \`${session.prefix}curar\`, \`${session.prefix}fugir\``;
}

async function action(ctx, kind) {
  const key = keyFor(ctx);
  const session = ctx.store.getSession(key);
  if (!session) return ctx.reply('Você não está em batalha. Use `!batalha` para começar.');
  const user = ctx.store.user(ctx.sender);
  const hero = user.rpg;
  const enemy = session.enemy;

  if (kind === 'fugir') {
    if (randomInt(1, 100) <= 60 || enemy.boss) {
      if (enemy.boss) return ctx.reply('Você não pode fugir de um chefe!');
      ctx.store.deleteSession(key);
      return ctx.reply('🏃 Você fugiu da batalha!', { react: '🏃' });
    }
    return ctx.reply('Você não conseguiu fugir!');
  }

  if (kind === 'curar') {
    if (!user.inventory.pocao) return ctx.reply('Você não tem poções. Compre com `!comprar pocao`.');
    user.inventory.pocao -= 1;
    const heal = Math.min(hero.maxHp - hero.hp, 14);
    hero.hp += heal;
    return ctx.reply(`🧪 Você curou ${heal} HP (${hero.hp}/${hero.maxHp}).\n\n${battleStatus(session)}`);
  }

  if (kind === 'defender') session.guard = true;

  let dealt = 0;
  if (kind === 'atacar') {
    const damage = Math.max(1, hero.atk + randomInt(-2, 3) - enemy.def);
    dealt = damage;
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp === 0) {
      ctx.store.deleteSession(key);
      ctx.store.addCoins(ctx.sender, enemy.reward);
      ctx.store.trackEvent?.('vitorias', 1);
      hero.xp += enemy.xp;
      hero.wins += 1;
      user.wins += 1;
      hero.level = Math.max(hero.level, ctxLevel(hero.xp));
      return ctx.reply(
        `💥 Você derrotou *${enemy.name}* com ${damage} de dano!\n` +
        `+${enemy.reward} moedas e +${enemy.xp} XP de herói.\n` +
        `Nível do herói: ${hero.level}`,
        { react: '🏆' }
      );
    }
  }

  const incoming = Math.max(1, enemy.atk + randomInt(-1, 2) - (session.guard ? hero.def * 2 : hero.def));
  hero.hp = Math.max(0, hero.hp - incoming);
  session.guard = false;
  ctx.store.touchSession(key, session);

  if (hero.hp === 0) {
    ctx.store.deleteSession(key);
    hero.losses += 1;
    hero.hp = 1;
    return ctx.reply(`💀 Você foi derrotado por *${enemy.name}*. Volte com mais poções!`, { react: '💀' });
  }

  const attackLine = kind === 'atacar'
    ? `⚔️ Você causou ${dealt} de dano. `
    : kind === 'defender' ? '🛡️ Você se defendeu. ' : '';
  return ctx.reply(
    `${attackLine}${enemy.emoji} *${enemy.name}* causou ${incoming} de dano.\n` +
    `❤️ HP: ${hero.hp}/${hero.maxHp}\n\n${battleStatus(session)}`
  );
}

export const rpgCommands = [
  {
    name: 'rpg',
    aliases: ['personagem', 'criar_personagem'],
    category: 'RPG',
    description: 'Criar ou ver seu personagem',
    usage: '!rpg guerreiro | !rpg mago | !rpg arqueiro',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      if (user.rpg) return ctx.reply(characterSheet(ctx, user.rpg));
      const key = normalize(ctx.args[0] || 'guerreiro');
      const chosen = CLASSES[key];
      if (!chosen) {
        return ctx.reply(`Escolha uma classe: ${Object.keys(CLASSES).join(', ')}.\nEx: \`${ctx.prefix}rpg mago\``);
      }
      user.rpg = {
        class: key, level: 1, xp: 0, hp: chosen.hp, maxHp: chosen.hp,
        atk: chosen.atk, def: chosen.def, wins: 0, losses: 0
      };
      return ctx.reply(`✨ Personagem criado!\n\n${characterSheet(ctx, user.rpg)}`, { react: '✨' });
    }
  },
  {
    name: 'batalha',
    aliases: ['lutar', 'fight'],
    category: 'RPG',
    description: 'Batalhar contra um monstro',
    usage: '!batalha',
    run(ctx) {
      const hero = getCharacter(ctx);
      if (!hero) return ctx.reply('Crie um personagem primeiro com `!rpg guerreiro`.');
      const key = keyFor(ctx);
      if (ctx.store.getSession(key)) return ctx.reply('Você já está em batalha!');
      const enemy = { ...randomItem(MONSTERS) };
      ctx.store.session(key, { type: 'rpg', enemy, guard: false, prefix: ctx.prefix });
      return ctx.reply(`⚔️ *Batalha iniciada!*\n\n${battleStatus(ctx.store.getSession(key))}`);
    }
  },
  {
    name: 'chefe',
    aliases: ['boss'],
    category: 'RPG',
    description: 'Desafiar o Dragão Ancião (4h)',
    usage: '!chefe',
    run(ctx) {
      const hero = getCharacter(ctx);
      if (!hero) return ctx.reply('Crie um personagem primeiro com `!rpg guerreiro`.');
      const user = ctx.store.user(ctx.sender);
      const remaining = (user.lastBoss || 0) + 4 * 3600000 - Date.now();
      if (remaining > 0) return ctx.reply(`O chefe já foi derrotado por você. Volte em ${formatMs(remaining)}.`);
      const key = keyFor(ctx);
      if (ctx.store.getSession(key)) return ctx.reply('Você já está em batalha!');
      user.lastBoss = Date.now();
      ctx.store.session(key, { type: 'rpg', enemy: { ...BOSS }, guard: false, prefix: ctx.prefix });
      return ctx.reply(`🐉 *CHEFE DESAFIADO!*\n\n${battleStatus(ctx.store.getSession(key))}`, { react: '🐉' });
    }
  },
  {
    name: 'atacar',
    aliases: ['attack'],
    category: 'RPG',
    description: 'Atacar na batalha',
    usage: '!atacar',
    run: (ctx) => action(ctx, 'atacar')
  },
  {
    name: 'defender',
    aliases: ['defesa', 'defend'],
    category: 'RPG',
    description: 'Defender-se na batalha',
    usage: '!defender',
    run: (ctx) => action(ctx, 'defender')
  },
  {
    name: 'curar',
    aliases: ['heal', 'cura'],
    category: 'RPG',
    description: 'Usar uma poção na batalha',
    usage: '!curar',
    run: (ctx) => action(ctx, 'curar')
  },
  {
    name: 'fugir',
    aliases: ['flee', 'correr'],
    category: 'RPG',
    description: 'Tentar fugir da batalha',
    usage: '!fugir',
    run: (ctx) => action(ctx, 'fugir')
  },
  {
    name: 'descansar',
    aliases: ['rest'],
    category: 'RPG',
    description: 'Recuperar todo o HP (10 min)',
    usage: '!descansar',
    run(ctx) {
      const hero = getCharacter(ctx);
      if (!hero) return ctx.reply('Crie um personagem primeiro com `!rpg guerreiro`.');
      const user = ctx.store.user(ctx.sender);
      const remaining = (user.lastRest || 0) + 600000 - Date.now();
      if (remaining > 0) return ctx.reply(`Você ainda está cansado. Volte em ${formatMs(remaining)}.`);
      user.lastRest = Date.now();
      hero.hp = hero.maxHp;
      return ctx.reply(`😴 Você descansou e recuperou todo o HP (${hero.hp}/${hero.maxHp}).`);
    }
  },
  {
    name: 'inventario',
    aliases: ['inv', 'bolsa'],
    category: 'RPG',
    description: 'Ver seu inventário',
    usage: '!inventario',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const entries = Object.entries(user.inventory).filter(([, count]) => count > 0);
      if (!entries.length) return ctx.reply('Seu inventário está vazio. Use `!loja` para comprar itens.');
      return ctx.reply(`🎒 *Inventário*\n\n${entries.map(([item, count]) => `${item}: *${count}*`).join('\n')}`);
    }
  },
  {
    name: 'usar',
    aliases: ['use'],
    category: 'RPG',
    description: 'Usar um item do inventário',
    usage: '!usar pocao',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const item = normalize(ctx.args[0]);
      if (!item || !user.inventory[item]) return ctx.reply('Item indisponível no inventário.');
      if (item === 'pocao') {
        const hero = getCharacter(ctx);
        if (!hero) return ctx.reply('Crie um personagem primeiro.');
        if (hero.hp >= hero.maxHp) return ctx.reply('Seu HP já está cheio.');
        user.inventory.pocao -= 1;
        hero.hp = Math.min(hero.maxHp, hero.hp + 14);
        return ctx.reply(`🧪 HP agora é ${hero.hp}/${hero.maxHp}.`);
      }
      if (item === 'amplificador') {
        user.inventory.amplificador -= 1;
        ctx.store.addXp(ctx.sender, 50);
        return ctx.reply('⚡ +50 XP adicionados!');
      }
      if (item === 'escudo') return ctx.reply('🛡️ O escudo é usado automaticamente ao defender na batalha.');
      return ctx.reply('Esse item não pode ser usado diretamente.');
    }
  },
  {
    name: 'missoes',
    aliases: ['missao', 'quests'],
    category: 'RPG',
    description: 'Missões diárias com recompensas',
    usage: '!missoes',
    run(ctx) {
      const user = ctx.store.user(ctx.sender);
      const today = new Date().toDateString();
      const fields = ['messages', 'commands', 'wins', 'jobs', 'investments', 'taxesPaid'];
      if (!user.missions || user.missions.date !== today) {
        user.missions = {
          date: today,
          start: Object.fromEntries(fields.map((field) => [field, user[field] || 0])),
          claimed: []
        };
      }
      const progressOf = (mission) =>
        Math.min(mission.goal, (user[mission.field] || 0) - (user.missions.start[mission.field] || 0));
      const lines = MISSIONS.map((mission) => {
        const progress = progressOf(mission);
        const done = progress >= mission.goal;
        const claimed = user.missions.claimed.includes(mission.id);
        return `${mission.icon} ${mission.name} — ${progress}/${mission.goal} ` +
          (claimed ? '✅ resgatada' : done ? `🎁 \`${ctx.prefix}missoes resgatar ${mission.id}\`` : '⏳');
      });
      if (normalize(ctx.args[0]) === 'resgatar') {
        const wanted = normalize(ctx.args[1]);
        const targets = wanted ? MISSIONS.filter((mission) => mission.id === wanted) : MISSIONS;
        if (!targets.length) return ctx.reply('Missão não encontrada. Veja `!missoes`.');
        let total = 0;
        let claimed = 0;
        for (const mission of targets) {
          if (progressOf(mission) < mission.goal || user.missions.claimed.includes(mission.id)) continue;
          user.missions.claimed.push(mission.id);
          ctx.store.addCoins(ctx.sender, mission.reward);
          ctx.store.trackEvent?.('missoes', 1);
          total += mission.reward;
          claimed += 1;
        }
        return ctx.reply(total
          ? `🎁 Você resgatou ${claimed} ${claimed === 1 ? 'missão' : 'missões'} e ganhou *${total} moedas*!`
          : 'Nenhuma missão pronta para resgate.');
      }
      return ctx.reply(`📜 *Missões diárias*\n\n${lines.join('\n')}\n\nResgate todas com \`${ctx.prefix}missoes resgatar\` ou uma específica pelo id.`);
    }
  }
];

export function handleMessage(ctx) {
  const words = new Set(ctx.body.toLowerCase().replace(ctx.prefix, '').trim().split(/\s+/));
  const actions = { atacar: 'atacar', defender: 'defender', curar: 'curar', fugir: 'fugir' };
  const kind = [...words].find((word) => actions[word]);
  if (!kind) return false;
  if (!ctx.store.getSession(keyFor(ctx))) return false;
  action(ctx, actions[kind]);
  return true;
}
