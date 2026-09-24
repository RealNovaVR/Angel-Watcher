const { PermissionsBitField } = require("discord.js");

const recentMessages = new Map();
const WINDOW_MS = 8000;
const MESSAGE_LIMIT = 6;
const CROSS_CHANNEL_LIMIT = 3;

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsBannedWord(content, bannedWords) {
  const normalized = normalize(content);
  return bannedWords.some(word => {
    const w = normalize(word);
    if (!w) return false;
    return new RegExp(`(^|\\s)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i").test(normalized);
  });
}

function isLink(content) {
  return /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(content);
}

function trackSpam(message) {
  const id = message.author.id;
  const now = Date.now();
  const list = recentMessages.get(id) || [];
  list.push({ time: now, channelId: message.channelId, message });
  const fresh = list.filter(x => now - x.time <= WINDOW_MS);
  recentMessages.set(id, fresh);

  const distinctChannels = new Set(fresh.map(x => x.channelId)).size;
  const shouldNuke = fresh.length >= MESSAGE_LIMIT || distinctChannels >= CROSS_CHANNEL_LIMIT;
  return { shouldNuke, fresh };
}

function canModerate(message) {
  if (!message.guild) return false;
  if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
  if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return false;
  return true;
}

async function deleteMessages(messages) {
  const unique = [...new Map(messages.map(m => [m.id, m])).values()];
  await Promise.allSettled(unique.map(m => m.deletable ? m.delete() : null));
}

async function sendLog(message, reason, extra = "") {
  const id = message.client.config.modLogChannelId;
  if (!id) return;
  const channel = await message.client.channels.fetch(id).catch(() => null);
  if (!channel?.isTextBased()) return;
  const safe = extra.slice(0, 900);
  await channel.send({
    embeds: [{
      title: "🛡️ Moderation Action",
      color: 0x5865F2,
      fields: [
        { name: "User", value: `${message.author.tag} (${message.author.id})` },
        { name: "Reason", value: reason },
        { name: "Channel", value: `<#${message.channelId}>` },
        ...(safe ? [{ name: "Details", value: safe }] : [])
      ],
      timestamp: new Date().toISOString()
    }]
  }).catch(() => {});
}

async function moderateMessage(message) {
  if (!message.guild || message.author.bot || !canModerate(message)) return;

  const config = message.client.config;
  const { shouldNuke, fresh } = trackSpam(message);

  if (shouldNuke) {
    await deleteMessages(fresh.map(x => x.message));
    await sendLog(message, "Spam / cross-channel flood", `Deleted ${fresh.length} recent messages.`);
    recentMessages.delete(message.author.id);

    await message.author.send(
      `Your recent messages were removed from **${message.guild.name}** because they were detected as spam/flooding. If your account was compromised, secure it immediately and contact staff.`
    ).catch(() => {});
    return;
  }

  if (containsBannedWord(message.content, config.bannedWords)) {
    if (message.deletable) await message.delete().catch(() => {});
    await message.author.send(
      `Your message in **${message.guild.name}** was removed because it contained a word or phrase that is not allowed in this server. Please review the rules and keep messages respectful.`
    ).catch(() => {});
    await sendLog(message, "Blocked word", "Message removed and user notified by DM.");
    return;
  }

  // Suspicious-link protection is deliberately conservative:
  // it flags obvious Discord invite links and common URL patterns, but does not
  // automatically delete every URL because legitimate links can be common.
  if (isLink(message.content) && /(free-nitro|claim.*reward|steamcommunity[^ ]*free|gift.*nitro|verify.*account)/i.test(message.content)) {
    if (message.deletable) await message.delete().catch(() => {});
    await message.author.send(
      `Your message in **${message.guild.name}** was removed because it looked like a suspicious/scam link. If this was legitimate, contact staff.`
    ).catch(() => {});
    await sendLog(message, "Suspicious/scam link", "Potential phishing or scam pattern.");
  }
}

module.exports = { moderateMessage };
