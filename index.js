const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    Events
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// =========================
// CONFIGURATION
// =========================

const BAD_WORDS = [
    "fuck",
    "nga",
    "nigger",
    "bitch",
    "b1tch",
    "n1gg3r",
    "n1gga",
    "n1gg4",
    "dick",
    "ass",
    "shit",
    "sh1t",
    "gigga",
    "daddy",
    "diddy",
    "shi",
    "mini09"
];

// How many warnings before timeout
const MAX_WARNINGS = 3;

// Timeout duration: 1 hour
const TIMEOUT_DURATION = 60 * 60 * 1000;

// Roles allowed to use moderation commands
const MODERATOR_ROLES = [
    process.env.MOD_ROLE_ID,
    process.env.ADMIN_ROLE_ID
].filter(Boolean);

// =========================
// WARNING STORAGE
// =========================

const WARNINGS_FILE = "./warnings.json";

function loadWarnings() {
    try {
        if (!fs.existsSync(WARNINGS_FILE)) {
            fs.writeFileSync(WARNINGS_FILE, "{}");
        }

        return JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf8"));
    } catch (error) {
        console.error("Could not load warnings:", error);
        return {};
    }
}

function saveWarnings(warnings) {
    fs.writeFileSync(
        WARNINGS_FILE,
        JSON.stringify(warnings, null, 4)
    );
}

let warnings = loadWarnings();

// =========================
// ROLE CHECK
// =========================

function hasModeratorRole(member) {
    if (!member) return false;

    return member.roles.cache.some(role =>
        MODERATOR_ROLES.includes(role.id)
    );
}

// =========================
// BAD WORD CHECK
// =========================

function containsBadWord(content) {
    const lowerContent = content.toLowerCase();

    return BAD_WORDS.some(word => {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Detect the word while avoiding matching it inside
        // unrelated words.
        const regex = new RegExp(`(^|\\s)${escapedWord}(?=\\s|$)`, "i");

        return regex.test(lowerContent);
    });
}

// =========================
// ADD WARNING
// =========================

async function addWarning(member, reason) {
    const userId = member.id;

    if (!warnings[userId]) {
        warnings[userId] = [];
    }

    warnings[userId].push({
        reason,
        timestamp: Date.now()
    });

    saveWarnings(warnings);

    return warnings[userId].length;
}

// =========================
// MESSAGE FILTER
// =========================

client.on(Events.MessageCreate, async message => {
    try {
        // Ignore bots
        if (message.author.bot) return;

        // Only moderate server messages
        if (!message.guild) return;

        // Check for bad words
        if (!containsBadWord(message.content)) return;

        const member = message.member;
        if (!member) return;

        // 1. DELETE THE BAD MESSAGE FIRST
        try {
            await message.delete();
            console.log(
                `Deleted bad message from ${message.author.tag}`
            );
        } catch (error) {
            console.error("Could not delete message:", error);
            return;
        }

        // 2. GIVE THE USER A WARNING
        const warningCount = await addWarning(
            member,
            "Using prohibited language"
        );

        // 3. DM THE USER AFTER THE MESSAGE WAS DELETED
        try {
            await member.send(
                `⚠️ **Warning**

Your message in **${message.guild.name}** was deleted because it contained prohibited language.

You now have **${warningCount}/${MAX_WARNINGS} warnings**.

Please do not use bad words in the server.`
            );
        } catch (error) {
            console.log(
                `Could not DM ${member.user.tag}. Their DMs may be disabled.`
            );
        }

        // 4. TIMEOUT AFTER 3 WARNINGS
        if (warningCount >= MAX_WARNINGS) {
    console.log(
        `⚠️ ${member.user.tag} reached ${warningCount} warnings. Attempting timeout...`
    );

    try {
        if (!member.moderatable) {
            console.log(
                `❌ Cannot timeout ${member.user.tag}. Check the bot's role hierarchy and Moderate Members permission.`
            );

            return;
        }

        await member.timeout(
            TIMEOUT_DURATION,
            "Reached 3 moderation warnings"
        );

        console.log(
            `🔇 Successfully timed out ${member.user.tag} for 1 hour.`
        );

        // Reset warnings
        delete warnings[member.id];
        saveWarnings(warnings);

        try {
            await member.send(
                `🔇 You have been **timed out for 1 hour** because you reached 3 warnings.`
            );
        } catch (error) {
            console.log("Could not DM user about timeout.");
        }

    } catch (error) {
        console.error("❌ TIMEOUT FAILED:");
        console.error(error);
    }
}


    } catch (error) {
        console.error("Moderation error:", error);
    }
});

// =========================
// SLASH COMMANDS
// =========================

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member;

    // Check moderator roles
    if (!hasModeratorRole(member)) {
        return interaction.reply({
            content: "❌ You don't have permission to use this command.",
            ephemeral: true
        });
    }

    // =========================
    // /warnings
    // =========================

    if (interaction.commandName === "warnings") {
        const user = interaction.options.getUser("user");

        const userWarnings = warnings[user.id] || [];

        if (userWarnings.length === 0) {
            return interaction.reply({
                content: `✅ ${user} has no warnings.`,
                ephemeral: true
            });
        }

        let text = `⚠️ **Warnings for ${user.username}**\n\n`;

        userWarnings.forEach((warning, index) => {
            const date = new Date(warning.timestamp);

            text += `**${index + 1}.** ${warning.reason}\n`;
            text += `📅 ${date.toLocaleString()}\n\n`;
        });

        await interaction.reply({
            content: text,
            ephemeral: true
        });
    }

    // =========================
    // /clearwarnings
    // =========================

    if (interaction.commandName === "clearwarnings") {
        const user = interaction.options.getUser("user");

        if (!warnings[user.id]) {
            return interaction.reply({
                content: `✅ ${user} already has no warnings.`,
                ephemeral: true
            });
        }

        delete warnings[user.id];
        saveWarnings(warnings);

        await interaction.reply({
            content: `✅ Cleared all warnings for ${user}.`,
            ephemeral: true
        });
    }

    // =========================
    // /warn
    // =========================

    if (interaction.commandName === "warn") {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const targetMember = await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!targetMember) {
            return interaction.reply({
                content: "❌ I couldn't find that member.",
                ephemeral: true
            });
        }

        const warningCount = await addWarning(
            targetMember,
            reason
        );

        await interaction.reply({
            content:
                `⚠️ Warned ${user}.\n` +
                `Reason: **${reason}**\n` +
                `Warnings: **${warningCount}/${MAX_WARNINGS}**`,
            ephemeral: true
        });

        // DM user
        try {
            await user.send(
                `⚠️ **You received a warning in ${interaction.guild.name}.**\n\n` +
                `Reason: **${reason}**\n` +
                `Warnings: **${warningCount}/${MAX_WARNINGS}**`
            );
        } catch (error) {
            console.log(`Could not DM ${user.tag}`);
        }

        // Timeout at 3 warnings
        if (warningCount >= MAX_WARNINGS) {
            try {
                if (targetMember.moderatable) {
                    await targetMember.timeout(
                        TIMEOUT_DURATION,
                        "Reached 3 warnings"
                    );

                    delete warnings[user.id];
                    saveWarnings(warnings);

                    try {
                        await user.send(
                            `🔇 You have been **timed out for 1 hour** because you reached ${MAX_WARNINGS} warnings.`
                        );
                    } catch (error) {
                        console.log(`Could not DM ${user.tag}`);
                    }

                    await interaction.followUp({
                        content: `🔇 ${user} reached ${MAX_WARNINGS} warnings and has been timed out for 1 hour.`,
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error("Timeout failed:", error);
            }
        }
    }
});

// =========================
// BOT READY
// =========================

client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log("🛡️ Moderation system is active.");
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
