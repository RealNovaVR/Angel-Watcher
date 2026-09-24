require("dotenv").config();

function csv(value) {
  return (value || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  prefix: process.env.PREFIX || "!",
  bannedWords: csv(process.env.BANNED_WORDS),
  sneakPeekChannelId: process.env.SNEAK_PEEK_CHANNEL_ID,
  sneakPeekRoleId: process.env.SNEAK_PEEK_ROLE_ID,
  sneakPeekStaffRoleId: process.env.SNEAK_PEEK_STAFF_ROLE_ID,
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID
};
