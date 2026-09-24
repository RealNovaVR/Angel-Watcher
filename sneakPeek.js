const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("sneak")
  .setDescription("Sneak peek tools")
  .addSubcommand(sub =>
    sub
      .setName("peek")
      .setDescription("Publish a sneak peek")
      .addStringOption(o =>
        o.setName("text")
          .setDescription("Optional text for the sneak peek")
          .setRequired(false)
      )
      .addAttachmentOption(o =>
        o.setName("image")
          .setDescription("Optional image attachment")
          .setRequired(false)
      )
  );

async function handle(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "sneak") return false;
  if (interaction.options.getSubcommand() !== "peek") return false;

  const config = interaction.client.config;
  if (!interaction.member.roles.cache.has(config.sneakPeekStaffRoleId)) {
    await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
    return true;
  }

  const target = await interaction.client.channels.fetch(config.sneakPeekChannelId).catch(() => null);
  if (!target?.isTextBased()) {
    await interaction.reply({ content: "The configured sneak peek channel is invalid or unavailable.", ephemeral: true });
    return true;
  }

  const text = interaction.options.getString("text") || "";
  const image = interaction.options.getAttachment("image");

  const embed = {
    title: "✨ Sneak Peek",
    description: text || "New content is coming soon!",
    color: 0x5865F2,
    footer: { text: "Final Tag VR • Sneak Peek" },
    timestamp: new Date().toISOString()
  };

  if (image?.contentType?.startsWith("image/")) embed.image = { url: image.url };

  await target.send({
    content: config.sneakPeekRoleId ? `<@&${config.sneakPeekRoleId}>` : undefined,
    embeds: [embed],
    allowedMentions: config.sneakPeekRoleId ? { roles: [config.sneakPeekRoleId] } : { parse: [] }
  });

  await interaction.reply({ content: "Sneak peek published.", ephemeral: true });
  return true;
}

module.exports = { command, handle };
