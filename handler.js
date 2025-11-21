import { generateWAMessageFromContent } from "baileys";
import { smsg } from './src/libraries/simple.js';
import { format } from 'util';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import { unwatchFile, watchFile } from 'fs';
import fs from 'fs';
import chalk from 'chalk';
import mddd5 from 'md5';
import ws from 'ws';
let mconn;

const { proto } = (await import("baileys")).default;
const isNumber = (x) => typeof x === 'number' && !isNaN(x);
const delay = (ms) => isNumber(ms) && new Promise((resolve) => setTimeout(function () {
  clearTimeout(this);
  resolve();
}, ms));

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || [];
  this.uptime = this.uptime || Date.now();
  if (!chatUpdate) {
    return;
  }
  this.pushMessage(chatUpdate.messages).catch(console.error);
  let m = chatUpdate.messages[chatUpdate.messages.length - 1];
  if (!m) {
    return;
  }
  if (global.db.data == null) await global.loadDatabase();

  try {
    m = smsg(this, m) || m;
    if (!m) {
      return;
    }
    global.mconn = m;
    mconn = m;

    const user = global.db.data.users[m.sender];
    if (typeof user !== 'object') {
      global.db.data.users[m.sender] = {};
    }

    const chat = global.db.data.chats[m.chat];
    if (typeof chat !== 'object') {
      global.db.data.chats[m.chat] = {};
    }

    const settings = global.db.data.settings[this.user.jid];
    if (typeof settings !== 'object') global.db.data.settings[this.user.jid] = {};

  } catch (e) {
    console.error(e);
  }

  if (opts['nyimak']) {
    return;
  }
  if (!m.fromMe && opts['self']) {
    return;
  }
  if (opts['pconly'] && m.chat.endsWith('g.us')) {
    return;
  }
  if (opts['gconly'] && !m.chat.endsWith('g.us')) {
    return;
  }
  if (opts['swonly'] && m.chat !== 'status@broadcast') {
    return;
  }
  if (typeof m.text !== 'string') {
    m.text = '';
  }

  const isROwner = [...global.owner.map(([number]) => number)].map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender);
  const isOwner = isROwner || m.fromMe;
  const isMods = isOwner || global.mods.map((v) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender);
  const isPrems = isROwner || isOwner || isMods || global.db.data.users[m.sender].premiumTime > 0;

  if (opts['queque'] && m.text && !(isMods || isPrems)) {
    const queque = this.msgqueque;
    const time = 1000 * 5;
    const previousID = queque[queque.length - 1];
    queque.push(m.id || m.key.id);
    setInterval(async function () {
      if (queque.indexOf(previousID) === -1) clearInterval(this);
      await delay(time);
    }, time);
  }

  if (m.isBaileys || (isBaileysFail && m?.sender === mconn?.conn?.user?.jid)) {
    return;
  }

  let usedPrefix;
  const groupMetadata = m.isGroup ? { ...(conn.chats[m.chat]?.metadata || await this.groupMetadata(m.chat).catch(_ => null) || {}), ...(((conn.chats[m.chat]?.metadata || await this.groupMetadata(m.chat).catch(_ => null) || {}).participants) && { participants: ((conn.chats[m.chat]?.metadata || await this.groupMetadata(m.chat).catch(_ => null) || {}).participants || []).map(p => ({ ...p, id: p.jid, jid: p.jid, lid: p.lid })) }) } : {};
  const participants = ((m.isGroup ? groupMetadata.participants : []) || []).map(participant => ({ id: participant.jid, jid: participant.jid, lid: participant.lid, admin: participant.admin }));
  const user = (m.isGroup ? participants.find((u) => conn.decodeJid(u.jid) === m.sender) : {}) || {};
  const bot = (m.isGroup ? participants.find((u) => conn.decodeJid(u.jid) == this.user.jid) : {}) || {};
  const isRAdmin = user?.admin == 'superadmin' || false;
  const isAdmin = isRAdmin || user?.admin == 'admin' || false;
  const isBotAdmin = bot?.admin || false;

  const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins');
  for (const name in global.plugins) {
    const plugin = global.plugins[name];
    if (!plugin || plugin.disabled) continue;

    const __filename = join(___dirname, name);
    if (typeof plugin.all === 'function') {
      try {
        await plugin.all.call(this, m, {
          chatUpdate,
          __dirname: ___dirname,
          __filename,
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (!opts['restrict']) {
      if (plugin.tags && plugin.tags.includes('admin')) {
        continue;
      }
    }

    const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
    const _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix;
    const match = (_prefix instanceof RegExp ?
      [[_prefix.exec(m.text), _prefix]] :
      Array.isArray(_prefix) ?
        _prefix.map(p => {
          const re = p instanceof RegExp ? p : new RegExp(str2Regex(p));
          return [re.exec(m.text), re];
        }) :
        [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]]
    ).find(p => p[1]);

    if (match) {
      const text = m.text.trim();
      if (text === '#') {
        await this.sendMessage(m.chat, { text: 'ese comando no existe' }, { quoted: m });
        return;
      }
      if (text === '#p') {
        const startTime = Date.now();
        const response = '✅ Bot activo.';
        const endTime = Date.now();
        const latency = endTime - startTime;
        await this.sendMessage(m.chat, { text: `${response}\n⏱️ Latencia: ${latency}ms` }, { quoted: m });
        return;
      }
    }
  }
}

export async function participantsUpdate({ id, participants, action }) {
  if (opts['self']) return;
  if (global.db.data == null) await loadDatabase();
  const chat = global.db.data.chats[id] || {};
  if (!chat.welcome || chat?.isBanned) return;

  if (action === 'remove' && participants.includes(mconn?.conn?.user?.jid)) return;

  const groupMetadata = await mconn?.conn?.groupMetadata(id) || (conn?.chats[id] || {}).metadata;
  for (const user of participants) {
    try {
      let pp = await mconn?.conn?.profilePictureUrl(user, 'image').catch(_ => 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60');
      const apii = await mconn?.conn?.getFile(pp);
      let text = (action === 'add' ?
        (chat.sWelcome || '👋 ¡Bienvenido/a!\n@user') :
        (chat.sBye || '👋 ¡Hasta luego!\n@user')
      ).replace('@user', '@' + user.split('@')[0]);
      await mconn?.conn?.sendFile(id, apii.data, 'pp.jpg', text, null, false, { mentions: [user] });
    } catch (e) {
      console.log(e);
    }
  }
}

export async function groupsUpdate(groupsUpdate) {
  if (opts['self']) return;
  for (const groupUpdate of groupsUpdate) {
    const id = groupUpdate.id;
    if (!id || groupUpdate.size == NaN || groupUpdate.subjectTime) continue;
    const chats = global.db.data.chats[id];
    if (!chats?.detect) continue;
    let text = '';
    if (groupUpdate?.desc) text = (chats?.sDesc || '```Descripción cambiada a:```\n@desc').replace('@desc', groupUpdate.desc);
    if (groupUpdate?.subject) text = (chats?.sSubject || '```Nombre del grupo cambiado a:```\n@subject').replace('@subject', groupUpdate.subject);
    if (groupUpdate?.icon) text = (chats?.sIcon || '```Foto del grupo actualizada```');
    if (groupUpdate?.revoke) text = (chats?.sRevoke || '```Enlace del grupo restablecido:\n@revoke```').replace('@revoke', groupUpdate.revoke);
    if (!text) continue;
    await mconn?.conn?.sendMessage(id, { text, mentions: mconn?.conn?.parseMention(text) });
  }
}

export async function callUpdate(callUpdate) {
  const isAnticall = global?.db?.data?.settings[mconn?.conn?.user?.jid]?.antiCall;
  if (!isAnticall) return;
  for (const nk of callUpdate) {
    if (nk.isGroup == false && nk.status == 'offer') {
      const callmsg = await mconn?.conn?.reply(nk.from, `Hola *@${nk.from.split('@')[0]}*, las ${nk.isVideo ? 'videollamadas' : 'llamadas'} no están permitidas, serás bloqueado.\n-\nSi accidentalmente llamaste póngase en contacto con mi creador para que te desbloquee!`, false, { mentions: [nk.from] });
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;Zero;;;\nFN:Zero\nORG:Zero\nitem1.TEL;waid=5219992095479:+521 999 209 5479\nitem1.X-ABLabel:Zero\nX-WA-BIZ-DESCRIPTION:[❗] ᴄᴏɴᴛᴀᴄᴛᴀ ᴀ ᴇsᴛᴇ ɴᴜᴍ ᴘᴀʀᴀ ᴄᴏsᴀs ɪᴍᴘᴏʀᴛᴀɴᴛᴇs.\nX-WA-BIZ-NAME:Zero\nEND:VCARD`;
      await mconn.conn.sendMessage(nk.from, { contacts: { displayName: 'Zero', contacts: [{ vcard }] } }, { quoted: callmsg });
      await mconn.conn.updateBlockStatus(nk.from, 'block');
    }
  }
}

export async function deleteUpdate(message) {
  let d = new Date(new Date + 3600000);
  let time = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
  try {
    const { fromMe, id, participant } = message;
    if (fromMe) return;
    let msg = mconn.conn.serializeM(mconn.conn.loadMessage(id));
    let chat = global.db.data.chats[msg?.chat] || {};
    if (!chat?.antidelete || !msg || !msg?.isGroup) return;
    const antideleteMessage = `⚠️ *Mensaje eliminado detectado*\n👤 Usuario: @${participant.split('@')[0]}\n🕒 Hora: ${time}\n\n💬 Aquí está el mensaje eliminado:`;
    await mconn.conn.sendMessage(msg.chat, { text: antideleteMessage, mentions: [participant] }, { quoted: msg });
    mconn.conn.copyNForward(msg.chat, msg).catch(e => console.log(e, msg));
  } catch (e) {
    console.error(e);
  }
}

global.dfail = (type, m, conn) => {
  const msg = {
    rowner: '⚠️ Este comando solo puede ser usado por el creador real del bot.',
    owner: '⚠️ Este comando solo puede ser usado por el dueño del bot.',
    mods: '⚠️ Este comando es solo para moderadores.',
    premium: '⚠️ Este comando es exclusivo para usuarios premium.',
    group: '⚠️ Este comando solo funciona en grupos.',
    private: '⚠️ Este comando solo funciona en chats privados.',
    admin: '⚠️ Necesitas ser administrador para usar este comando.',
    botAdmin: '⚠️ El bot debe ser administrador para ejecutar esta acción.',
    unreg: '⚠️ Debes registrarte para usar este comando. Usa #reg para registrarte.',
    restrict: '⚠️ Esta función está restringida por el dueño del bot.'
  }[type];

  if (msg) {
    const aa = { quoted: m, userJid: conn.user.jid };
    const prep = generateWAMessageFromContent(m.chat, { extendedTextMessage: { text: msg } }, aa);
    return conn.relayMessage(m.chat, prep.message, { messageId: prep.key.id });
  }
};

const file = global.__filename(import.meta.url, true);
watchFile(file, async () => {
  unwatchFile(file);
  console.log(chalk.redBright('Update \'handler.js\''));
  if (global.reloadHandler) console.log(await global.reloadHandler());

  if (global.conns && global.conns.length > 0) {
    const users = [...new Set([...global.conns.filter((conn) => conn.user && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED).map((conn) => conn)])];
    for (const userr of users) {
      userr.subreloadHandler(false);
    }
  }
});
