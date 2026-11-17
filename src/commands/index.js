import { diversaoCommands } from './diversao.js';
import { jogosCommands } from './jogos.js';
import { utilidadesCommands } from './utilidades.js';
import { infoCommands } from './info.js';
import { socialCommands } from './social.js';
import { adminCommands } from './admin.js';
import { moderationCommands } from './moderation.js';
import { activityCommands } from './atividade.js';
import { economiaCommands } from './economia.js';
import { rpgCommands } from './rpg.js';
import { novosJogosCommands } from './jogosnovos.js';
import { midiaCommands } from './midia.js';
import { playCommands } from './play.js';
import { bancoCommands } from './banco.js';
import { eventoCommands } from './eventos.js';

export const commands = [
  ...infoCommands,
  ...diversaoCommands,
  ...jogosCommands,
  ...novosJogosCommands,
  ...rpgCommands,
  ...economiaCommands,
  ...bancoCommands,
  ...eventoCommands,
  ...utilidadesCommands,
  ...socialCommands,
  ...midiaCommands,
  ...playCommands,
  ...activityCommands,
  ...adminCommands,
  ...moderationCommands
];

const index = new Map();
for (const command of commands) {
  for (const name of [command.name, ...(command.aliases || [])]) {
    index.set(name.toLowerCase(), command);
  }
}

export function findCommand(name) {
  return index.get(String(name || '').toLowerCase()) || null;
}
