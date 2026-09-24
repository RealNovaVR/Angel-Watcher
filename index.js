const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  EmbedBuilder,
  REST,
  Routes
} = require("discord.js");

const DIRECT_BAD_WORDS = [
  "fuck",
  "shit",
  "ass",
  "nigga",
  "nigger",
  "hitler",
  "nazi",
];

const config = require("./config");
const rules = require("./rules");
const { moderateMessage } = require("./moderation");
const { command: sneakCommand, handle: handleSneak } = require("./sneakPeek");

if (!config.token) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.config = config;

function ruleEmbed(number) {
  const rule = rules[number];
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📜 Rule ${number} — ${rule.title}`)
    .setDescription(rule.text)
    .setFooter({ text: "Final Tag VR • Server Rules" });
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Final Tag VR", type: ActivityType.Watching }],
    status: "online"
  });

  const rest = new REST({ version: "10" }).setToken(config.token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [sneakCommand.toJSON()]
    });
    console.log("Registered /sneak peek");
  } catch (err) {
    console.error("Slash-command registration failed:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const content = message.content.trim();
  const match = /^r(\d{1,2})\?$/.exec(content);

  if (match) {
    const number = Number(match[1]);
    const rule = rules[number];
    if (rule) {
      await message.reply({
        embeds: [{
          title: `📜 Final Tag VR — Rule ${number}`,
          description: rule,
          color: 0x5865F2,
          footer: { text: "Final Tag VR • Server Rules" }
        }]
      }).catch(() => {});
    }
    return;
  }

  await moderateMessage(message);
});

client.on("interactionCreate", async interaction => {
  try {
    await handleSneak(interaction);
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Something went wrong while processing that command.", ephemeral: true }).catch(() => {});
    }
  }
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);

const http = require("http");
const PORT = Number(process.env.PORT || 3000);

http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type":"text/plain; charset=utf-8"});
  res.end("Final Tag VR bot is online.\n");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Health server listening on port ${PORT}`);
});

client.login(config.token);
