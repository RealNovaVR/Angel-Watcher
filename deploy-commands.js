const {
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

require("dotenv").config();

const commands = [
    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a user's warnings")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to check")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clearwarnings")
        .setDescription("Clear all warnings for a user")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user whose warnings should be cleared")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Give a user a warning")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to warn")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Why the user is being warned")
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("✅ Slash commands registered!");
    } catch (error) {
        console.error(error);
    }
})();
