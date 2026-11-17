import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return fallback;
  }
}

const USER_DEFAULTS = {
  xp: 0,
  messages: 0,
  commands: 0,
  level: 1,
  lastDaily: 0,
  wins: 0,
  coins: 0,
  streak: 0,
  titles: [],
  activeTitle: null,
  inventory: {},
  rpg: null,
  bank: 0,
  bankInterestAt: 0,
  workAt: 0,
  investAt: 0,
  jobs: 0,
  investments: 0,
  taxesPaid: 0,
  taxDebt: 0
};

const GROUP_DEFAULTS = {
  antilink: config.antilinkDefault,
  filter: config.filterDefault,
  welcome: config.welcomeEnabled,
  welcomeText: 'Olá, @user! Bem-vindo(a) ao grupo 👋',
  autofigu: false,
  autoResponseEnabled: false,
  autoResponses: [],
  allowedDomains: [],
  muted: [],
  warnings: {},
  blacklist: [],
  cooldown: config.cooldown
};

function cloneGroupDefaults() {
  return {
    ...GROUP_DEFAULTS,
    autoResponses: [],
    allowedDomains: [],
    muted: [],
    warnings: {},
    blacklist: []
  };
}

export class Store {
  constructor(directory = config.dataDir) {
    this.directory = directory;
    this.usersFile = path.join(directory, 'users.json');
    this.groupsFile = path.join(directory, 'groups.json');
    this.statsFile = path.join(directory, 'stats.json');
    this.activityFile = path.join(directory, 'activity.json');
    this.users = loadJson(this.usersFile, {});
    for (const [jid, data] of Object.entries(this.users)) {
      this.users[jid] = { ...USER_DEFAULTS, ...data };
    }
    this.groups = loadJson(this.groupsFile, {});
    for (const [jid, data] of Object.entries(this.groups)) {
      this.groups[jid] = { ...cloneGroupDefaults(), ...data };
    }
    this.activity = loadJson(this.activityFile, {});
    this.stats = loadJson(this.statsFile, { messages: 0, commands: 0, startedAt: Date.now() });
    this.sessions = new Map();
    this.rateLimits = new Map();
    this.saveTimer = null;
    fs.mkdirSync(directory, { recursive: true });
  }

  user(jid) {
    if (!this.users[jid]) {
      this.users[jid] = { ...USER_DEFAULTS };
    }
    return this.users[jid];
  }

  addCoins(jid, amount) {
    const user = this.user(jid);
    user.coins = Math.max(0, user.coins + amount);
    return user.coins;
  }

  spendCoins(jid, amount) {
    const user = this.user(jid);
    if (user.coins < amount) return false;
    user.coins -= amount;
    return true;
  }

  depositCoins(jid, amount) {
    const user = this.user(jid);
    if (user.coins < amount) return false;
    user.coins -= amount;
    user.bank = (user.bank || 0) + amount;
    if (!user.bankInterestAt) user.bankInterestAt = Date.now();
    return true;
  }

  withdrawCoins(jid, amount) {
    const user = this.user(jid);
    if ((user.bank || 0) < amount) return false;
    user.bank -= amount;
    user.coins += amount;
    return true;
  }

  addTaxDebt(jid, amount) {
    const user = this.user(jid);
    user.taxDebt = Math.max(0, (user.taxDebt || 0) + amount);
    return user.taxDebt;
  }

  payTax(jid) {
    const user = this.user(jid);
    const debt = user.taxDebt || 0;
    if (debt <= 0 || user.coins < debt) return false;
    user.coins -= debt;
    user.taxDebt = 0;
    user.taxesPaid = (user.taxesPaid || 0) + 1;
    return true;
  }

  group(jid) {
    if (!this.groups[jid]) {
      this.groups[jid] = cloneGroupDefaults();
    }
    return this.groups[jid];
  }

  trackActivity(groupId, userId, name = '', type = 'message') {
    if (!groupId || !userId) return;
    if (!this.activity[groupId]) this.activity[groupId] = {};
    const entry = this.activity[groupId][userId] || {
      userId, name: '', messages: 0, commands: 0, stickers: 0, lastAt: 0
    };
    const column = type === 'command' ? 'commands' : type === 'sticker' ? 'stickers' : 'messages';
    entry[column] += 1;
    if (name) entry.name = name;
    entry.lastAt = Date.now();
    this.activity[groupId][userId] = entry;
  }

  activityRanking(groupId, limit = 10) {
    const entries = Object.values(this.activity[groupId] || {});
    return entries
      .map((entry) => ({ ...entry, total: entry.messages + entry.commands + entry.stickers }))
      .sort((a, b) => b.total - a.total || b.lastAt - a.lastAt)
      .slice(0, limit);
  }

  activityFor(groupId, userId) {
    return this.activity[groupId]?.[userId] || null;
  }

  inactiveMembers(groupId, participants = [], threshold = 5) {
    const limit = Number.isFinite(Number(threshold)) ? Math.max(1, Number(threshold)) : 5;
    const records = this.activity[groupId] || {};
    const members = participants.length ? participants : Object.keys(records).map((jid) => ({ id: jid }));
    return members.filter((member) => {
      if (!member?.id || member.admin || member.isAdmin) return false;
      const entry = records[member.id];
      const total = entry ? entry.messages + entry.commands + entry.stickers : 0;
      return total < limit;
    });
  }

  addXp(jid, amount = config.xpPerMessage) {
    const user = this.user(jid);
    user.xp += amount;
    user.messages += 1;
    this.stats.messages += 1;
    const newLevel = Store.levelForXp(user.xp);
    const leveledUp = newLevel > user.level;
    user.level = newLevel;
    return { user, leveledUp, level: newLevel };
  }

  static levelForXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
  }

  static xpForLevel(level) {
    return (Math.max(1, level) - 1) ** 2 * 100;
  }

  session(key, value) {
    this.sessions.set(key, { ...value, createdAt: Date.now(), updatedAt: Date.now() });
    return this.sessions.get(key);
  }

  getSession(key) {
    const value = this.sessions.get(key);
    if (value && Date.now() - value.updatedAt > 5 * 60 * 1000) {
      this.sessions.delete(key);
      return null;
    }
    return value;
  }

  touchSession(key, value) {
    const session = this.sessions.get(key);
    if (!session) return null;
    Object.assign(session, value, { updatedAt: Date.now() });
    return session;
  }

  deleteSession(key) {
    this.sessions.delete(key);
  }

  allow(key, windowMs = 1000) {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry || now - entry.start > windowMs) {
      this.rateLimits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= config.rateLimit;
  }

  ranking(limit = 10) {
    return Object.entries(this.users)
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, limit);
  }

  save() {
    const write = (file, data) => {
      const temp = `${file}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(data, null, 2));
      fs.renameSync(temp, file);
    };
    try {
      write(this.usersFile, this.users);
      write(this.groupsFile, this.groups);
      write(this.activityFile, this.activity);
      write(this.statsFile, this.stats);
    } catch (error) {
      console.error('Erro ao salvar dados:', error.message);
    }
  }

  startAutoSave(intervalMs = 10000) {
    this.saveTimer = setInterval(() => this.save(), intervalMs);
    this.saveTimer.unref?.();
  }

  stop() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.save();
  }
}

export const store = new Store();
