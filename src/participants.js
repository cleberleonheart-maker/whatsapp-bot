import { jidToNumber } from './utils.js';

const isLid = (jid) => String(jid || '').endsWith('@lid');
const isUser = (jid) => String(jid || '').endsWith('@s.whatsapp.net');

export function participantRecord(ctx, jid) {
  const members = ctx.groupMembers || ctx.groupMetadata?.participants || [];
  return members.find((member) => member.id === jid || member.lid === jid || member.jid === jid) || null;
}

export function phoneJidFor(ctx, jid) {
  const member = participantRecord(ctx, jid);
  if (member?.jid) return member.jid;
  const key = ctx.msg?.key || {};
  if (isLid(jid)) {
    const fromMessage = key.participantPn || key.senderPn;
    if (fromMessage) return fromMessage;
    const mapped = ctx.sock?.lidToJid?.get?.(jid);
    if (mapped) return mapped;
  }
  return isUser(jid) ? jid : '';
}

export function formatPhone(jid) {
  const digits = jidToNumber(jid);
  if (!digits) return '';
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits.length >= 10 ? `+${digits}` : digits;
}

export function participantLabel(ctx, jid) {
  const member = participantRecord(ctx, jid);
  const phone = formatPhone(phoneJidFor(ctx, jid));
  const activity = ctx.store?.activity?.[ctx.jid]?.[jid];
  const name = member?.name || member?.notify || activity?.name || '';
  if (name && phone) return `${name} (${phone})`;
  if (phone) return phone;
  if (name) return name;
  return `@${String(jid || '').split('@')[0]}`;
}
