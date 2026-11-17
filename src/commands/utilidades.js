import { safeMath, generatePassword, formatDate, clamp, normalize, truncate } from '../utils.js';

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'BrincaBot/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const TIMEZONES = {
  brasilia: 'America/Sao_Paulo',
  sp: 'America/Sao_Paulo',
  rio: 'America/Sao_Paulo',
  lisboa: 'Europe/Lisbon',
  londres: 'Europe/London',
  novaiorque: 'America/New_York',
  ny: 'America/New_York',
  toquio: 'Asia/Tokyo',
  moscou: 'Europe/Moscow',
  sydney: 'Australia/Sydney'
};

const WEATHER_CODES = {
  0: '☀️ Limpo', 1: '🌤️ Predominantemente limpo', 2: '⛅ Parcialmente nuvem', 3: '☁️ Nublado',
  45: '🌫️ Neblina', 48: '🌫️ Neblina com geada', 51: '🌦️ Garoa leve', 53: '🌦️ Garoa',
  55: '🌧️ Garoa forte', 61: '🌧️ Chuva leve', 63: '🌧️ Chuva', 65: '🌧️ Chuva forte',
  71: '🌨️ Neve leve', 73: '🌨️ Neve', 75: '❄️ Neve forte', 80: '🌦️ Pancadas leves',
  81: '🌧️ Pancadas de chuva', 82: '⛈️ Pancadas fortes', 95: '⛈️ Tempestade',
  96: '⛈️ Tempestade com granizo', 99: '⛈️ Tempestade com granizo forte'
};

export const utilidadesCommands = [
  {
    name: 'calc',
    aliases: ['calcular', 'calculadora', 'conta'],
    category: 'Utilidades',
    description: 'Calcular uma expressão matemática',
    usage: '!calc (2+3)*4',
    run(ctx) {
      const expression = ctx.text;
      if (!expression) return ctx.reply(`Envie uma expressão. Ex: \`${ctx.prefix}calc (2+3)*4\``);
      try {
        const result = safeMath(expression);
        const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(result);
        return ctx.reply(`🧮 \`${truncate(expression, 100)}\` = *${formatted}*`);
      } catch (error) {
        return ctx.reply(`Não consegui calcular isso. ${error.message}`);
      }
    }
  },
  {
    name: 'senha',
    aliases: ['password', 'gerarsenha'],
    category: 'Utilidades',
    description: 'Gerar uma senha aleatória',
    usage: '!senha [tamanho]',
    run(ctx) {
      const length = Number.parseInt(ctx.args[0], 10) || 16;
      const password = generatePassword(length);
      return ctx.reply(`🔐 Senha gerada:\n\`${password}\`\n\nTamanho: ${password.length} caracteres.`);
    }
  },
  {
    name: 'cep',
    aliases: ['endereco', 'buscacep'],
    category: 'Utilidades',
    description: 'Consultar um CEP na ViaCEP',
    usage: '!cep 01001-000',
    run(ctx) {
      const cep = ctx.args.join('').replace(/\D/g, '');
      if (cep.length !== 8) return ctx.reply('Informe um CEP válido com 8 dígitos.');
      return fetchJson(`https://viacep.com.br/ws/${cep}/json/`)
        .then((data) => {
          if (data.erro) return ctx.reply('CEP não encontrado.');
          return ctx.reply(
            `📍 *Endereço*\n\n${data.logradouro || '—'}, ${data.bairro || '—'}\n` +
            `${data.localidade}/${data.uf} — CEP ${data.cep}\n${data.complemento ? `Complemento: ${data.complemento}` : ''}`
          );
        })
        .catch(() => ctx.reply('Não consegui consultar esse CEP agora.'));
    }
  },
  {
    name: 'clima',
    aliases: ['tempo', 'weather', 'previsao'],
    category: 'Utilidades',
    description: 'Clima atual de uma cidade',
    usage: '!clima São Paulo',
    run(ctx) {
      const city = ctx.text;
      if (!city) return ctx.reply(`Informe a cidade. Ex: \`${ctx.prefix}clima São Paulo\``);
      return (async () => {
        try {
          const geo = await fetchJson(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`
          );
          const place = geo.results?.[0];
          if (!place) return ctx.reply('Cidade não encontrada.');
          const weather = await fetchJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
            '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto'
          );
          const current = weather.current;
          return ctx.reply(
            `🌤️ *Clima em ${place.name}${place.country ? `, ${place.country}` : ''}*\n\n` +
            `${WEATHER_CODES[current.weather_code] || 'Condição desconhecida'}\n` +
            `🌡️ Temperatura: ${current.temperature_2m}°C\n` +
            `💧 Umidade: ${current.relative_humidity_2m}%\n` +
            `💨 Vento: ${current.wind_speed_10m} km/h`
          );
        } catch {
          return ctx.reply('Não consegui consultar o clima agora.');
        }
      })();
    }
  },
  {
    name: 'wiki',
    aliases: ['wikipedia', 'pesquisa'],
    category: 'Utilidades',
    description: 'Resumo de um artigo da Wikipédia',
    usage: '!wiki Inteligência artificial',
    run(ctx) {
      const term = ctx.text;
      if (!term) return ctx.reply(`Informe o termo. Ex: \`${ctx.prefix}wiki Brasil\``);
      return fetchJson(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, '_'))}`)
        .then((data) => {
          if (data.type === 'disambiguation') return ctx.reply('Esse termo tem vários significados. Seja mais específico.');
          return ctx.reply(
            `*${data.title}*\n\n${truncate(data.extract || 'Sem resumo disponível.', 900)}\n\n${data.content_urls?.desktop?.page || ''}`
          );
        })
        .catch(() => ctx.reply('Artigo não encontrado ou indisponível.'));
    }
  },
  {
    name: 'traduzir',
    aliases: ['traducao', 'translate'],
    category: 'Utilidades',
    description: 'Traduzir texto (pt↔en, etc.)',
    usage: '!traduzir pt=en olá mundo',
    run(ctx) {
      const match = /^([a-z]{2})\s*=\s*([a-z]{2})\s+(.+)$/i.exec(ctx.text);
      if (!match) return ctx.reply(`Use: \`${ctx.prefix}traduzir pt=en olá mundo\``);
      const [, from, to, text] = match;
      return fetchJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      )
        .then((data) => {
          if (data.responseStatus !== 200) throw new Error('Falha na tradução');
          return ctx.reply(`🌐 *${from.toUpperCase()} → ${to.toUpperCase()}*\n\n${data.responseData.translatedText}`);
        })
        .catch(() => ctx.reply('Não consegui traduzir agora. Verifique os idiomas e tente novamente.'));
    }
  },
  {
    name: 'moeda',
    aliases: ['cambio', 'converter'],
    category: 'Utilidades',
    description: 'Converter moedas (taxas atuais)',
    usage: '!moeda 100 BRL USD',
    run(ctx) {
      const match = /^([\d.,]+)\s*([a-z]{3})\s+([a-z]{3})$/i.exec(ctx.text);
      if (!match) return ctx.reply(`Use: \`${ctx.prefix}moeda 100 BRL USD\``);
      const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(amount)) return ctx.reply('Valor inválido.');
      const from = match[2].toUpperCase();
      const to = match[3].toUpperCase();
      if (from === to) return ctx.reply('As moedas são iguais.');
      return fetchJson(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`)
        .then((data) => {
          const converted = data.rates?.[to];
          if (!converted) return ctx.reply('Moeda não suportada.');
          return ctx.reply(
            `💱 *${new Intl.NumberFormat('pt-BR').format(amount)} ${from}* = ` +
            `*${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(converted)} ${to}*\n` +
            `Taxa em ${formatDate(new Date(data.date + 'T12:00:00'), ctx.config.timezone)}`
          );
        })
        .catch(() => ctx.reply('Não consegui consultar a cotação agora.'));
    }
  },
  {
    name: 'horario',
    aliases: ['hora', 'time', 'relogio'],
    category: 'Utilidades',
    description: 'Hora atual em diferentes cidades',
    usage: '!horario [cidade]',
    run(ctx) {
      const key = normalize(ctx.text).replace(/[^a-z]/g, '');
      const zone = TIMEZONES[key] || ctx.config.timezone;
      const now = new Date();
      const time = new Intl.DateTimeFormat('pt-BR', {
        timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(now);
      const date = new Intl.DateTimeFormat('pt-BR', {
        timeZone: zone, weekday: 'long', day: '2-digit', month: 'long'
      }).format(now);
      return ctx.reply(`🕐 *${key && TIMEZONES[key] ? key : 'Horário local'}*: ${time}\n📅 ${date}`);
    }
  },
  {
    name: 'figurinha',
    aliases: ['sticker', 'webp'],
    category: 'Utilidades',
    description: 'Transformar uma imagem em figurinha',
    usage: '!figurinha (com imagem ou respondendo uma imagem)',
    async run(ctx) {
      const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo;
      const target = quoted?.quotedMessage
        ? { message: quoted.quotedMessage }
        : ctx.msg;
      const hasImage = target.message?.imageMessage;
      if (!hasImage) return ctx.reply('Envie uma imagem junto com o comando ou responda a uma imagem.');

      let sharp;
      try {
        sharp = (await import('sharp')).default;
      } catch {
        return ctx.reply('Recurso indisponível: instale o pacote opcional `sharp` para criar figurinhas.');
      }

      try {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: ctx.sock.logger });
        const sticker = await sharp(buffer).resize(512, 512, { fit: 'inside' }).webp().toBuffer();
        await ctx.sock.sendMessage(ctx.jid, { sticker }, { quoted: ctx.msg });
        return ctx.react('✨');
      } catch {
        return ctx.reply('Não consegui converter a imagem. Tente outra imagem.');
      }
    }
  },
  {
    name: 'lembrete',
    aliases: ['reminder', 'lembrar'],
    category: 'Utilidades',
    description: 'Criar um lembrete (ex: 10m texto)',
    usage: '!lembrete 10m tomar água',
    run(ctx) {
      const match = /^(\d+)\s*(s|m|h|d)\s+(.+)$/i.exec(ctx.text);
      if (!match) return ctx.reply(`Use: \`${ctx.prefix}lembrete 10m tomar água\``);
      const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
      const delay = clamp(Number(match[1]) * unit, 10000, 7 * 86400000);
      const text = match[3];
      setTimeout(() => {
        ctx.sock.sendMessage(ctx.jid, { text: `⏰ *Lembrete*: ${text}` }, { mentions: ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [] })
          .catch(() => {});
      }, delay);
      return ctx.reply(`⏰ Lembrete agendado para daqui a ${Math.round(delay / 60000)} minuto(s).`);
    }
  }
];
