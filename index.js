const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    ActivityType,
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

// ============================================================
// FINAL TAG VR — Discord Community & Moderation Bot
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// ============================================================
// CONFIGURATION
// ============================================================

const BOT_STATUS = "Final Tag VR";
const INACTIVITY_MS = 2 * 60 * 1000;

// Put the role you want pinged after 2 minutes of inactivity here.
// If INACTIVE_ROLE_ID is not set, the bot falls back to MOD_ROLE_ID.
const INACTIVE_ROLE_ID =
    process.env.INACTIVE_ROLE_ID || process.env.MOD_ROLE_ID || null;

// Optional: force inactivity alerts into one channel.
// If empty, the bot uses the last channel where a member spoke.
const INACTIVITY_CHANNEL_ID = process.env.INACTIVITY_CHANNEL_ID || null;

const MAX_WARNINGS = 3;
const TIMEOUT_DURATION = 60 * 60 * 1000;

const MODERATOR_ROLES = [
    process.env.MOD_ROLE_ID,
    process.env.ADMIN_ROLE_ID
].filter(Boolean);

// ============================================================
// RULES
// ============================================================

const RULES = {
    1: {
        title: "Be Respectful",
        description:
            "Treat everyone with respect. No bullying, harassment, racism, homophobia, or unnecessary toxicity."
    },
    2: {
        title: "No Spamming",
        description:
            "Don't use mods, exploits, glitches, or anything that gives you an unfair advantage."
    },
    3: {
        title: "No NSFW",
        description:
            "NSFW, sexual, or overly graphic content is not allowed anywhere in the server."
    },
    4: {
        title: "No Advertising",
        description:
            "Don't advertise your own servers, games, channels, or social media without permission."
    },
    5: {
        title: "Keep It Appropriate",
        description:
            "Don't send offensive, disturbing, or inappropriate content. Use common sense."
    },
    6: {
        title: "No Drama",
        description:
            "Don't start arguments or bring personal drama into the server. Take private issues somewhere else."
    },
    7: {
        title: "Don't Impersonate Staff",
        description:
            "Never pretend to be an owner, moderator, developer, or other member of the staff team."
    },
    8: {
        title: "No Scamming or Malicious Links",
        description:
            "Do not scam, phish, steal accounts, or send suspicious/malicious links."
    },
    9: {
        title: "Respect Staff Decisions",
        description:
            "Staff are here to keep the server safe and enjoyable. If you disagree with a decision, contact staff calmly instead of causing an argument."
    },
    10: {
        title: "Follow Discord's Rules",
        description:
            "You must follow Discord's Terms of Service and Community Guidelines while using this server."
    },
    11: {
        title: "Use Channels Correctly",
        description:
            "Keep conversations in their proper channels. Don't fill unrelated channels with off-topic messages."
    }
};

function createRulesEmbed() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📜 FINAL TAG VR — SERVER RULES")
        .setDescription(
            "**Please follow all the rules.**\n\n" +
            "Need one rule? Type `r1?`, `r2?`, `r3?` ... `r11?`.\n" +
            "You can also use `/rule`."
        )
        .setFooter({ text: "Final Tag VR • Keep the server fun and respectful." })
        .setTimestamp();

    for (const [number, rule] of Object.entries(RULES)) {
        embed.addFields({
            name: `Rule ${number} — ${rule.title}`,
            value: rule.description
        });
    }

    return embed;
}

function createRuleEmbed(number) {
    const rule = RULES[number];

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📜 Rule ${number} — ${rule.title}`)
        .setDescription(rule.description)
        .setFooter({
            text: `Final Tag VR • Rule ${number} of ${Object.keys(RULES).length}`
        })
        .setTimestamp();
}

// ============================================================
// WARNING STORAGE
// ============================================================

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

function saveWarnings(data) {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 4));
}

let warnings = loadWarnings();

// ============================================================
// INACTIVITY TRACKING
// ============================================================

const inactivityState = new Map();

function touchGuildActivity(message) {
    if (!message.guild) return;

    inactivityState.set(message.guild.id, {
        lastActivity: Date.now(),
        lastChannelId: message.channelId,
        alerted: false
    });
}

async function sendInactivityAlert(guild, state) {
    if (!INACTIVE_ROLE_ID) {
        console.warn(
            `[${guild.name}] No INACTIVE_ROLE_ID or MOD_ROLE_ID configured.`
        );
        return;
    }

    const channel =
        (INACTIVITY_CHANNEL_ID &&
            guild.channels.cache.get(INACTIVITY_CHANNEL_ID)) ||
        (state.lastChannelId && guild.channels.cache.get(state.lastChannelId)) ||
        guild.systemChannel;

    if (!channel || !channel.isTextBased()) {
        console.warn(`[${guild.name}] Could not find a text channel for inactivity alert.`);
        return;
    }

    const role = guild.roles.cache.get(INACTIVE_ROLE_ID);
    if (!role) {
        console.warn(
            `[${guild.name}] Could not find inactivity role ${INACTIVE_ROLE_ID}.`
        );
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("⏳ Server Check-In")
        .setDescription(
            `It has been about **2 minutes** since the last member message.\n\n` +
            `**Question:** What are you playing or working on right now? 🎮`
        )
        .setFooter({ text: "Final Tag VR • Activity check" })
        .setTimestamp();

    try {
        await channel.send({
            content: `${role}`,
            embeds: [embed],
            allowedMentions: { roles: [role.id] }
        });

        console.log(`[${guild.name}] Inactivity alert sent.`);
    } catch (error) {
        console.error(`[${guild.name}] Could not send inactivity alert:`, error);
    }
}

setInterval(async () => {
    const now = Date.now();

    for (const [guildId, state] of inactivityState.entries()) {
        if (state.alerted) continue;
        if (now - state.lastActivity < INACTIVITY_MS) continue;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        await sendInactivityAlert(guild, state);
        state.alerted = true;
    }
}, 15 * 1000);

// ============================================================
// ROLE CHECK
// ============================================================

function hasModeratorRole(member) {
    if (!member) return false;

    return member.roles.cache.some(role =>
        MODERATOR_ROLES.includes(role.id)
    );
}

// ============================================================
// BAD WORD CHECK
// ============================================================

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
    "mini09",
    "H1tler",
    "hitler",
    "hitl3r"
];

function containsBadWord(content) {
    const lowerContent = content.toLowerCase();

    return BAD_WORDS.some(word => {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(^|\\s)${escapedWord}(?=\\s|$)`, "i");
        return regex.test(lowerContent);
    });
}

// ============================================================
// ADD WARNING
// ============================================================

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

// ============================================================
// MESSAGE HANDLER
// ============================================================

client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot) return;
        if (!message.guild) return;

        // Any real member message counts as activity.
        touchGuildActivity(message);

        // --------------------------------------------------------
        // RULE LOOKUP: r1? through r11?
        // --------------------------------------------------------

        const ruleMatch = message.content.trim().match(/^r(\d+)\?$/i);

        if (ruleMatch) {
            const ruleNumber = Number(ruleMatch[1]);

            if (RULES[ruleNumber]) {
                await message.reply({
                    embeds: [createRuleEmbed(ruleNumber)],
                    allowedMentions: { repliedUser: false }
                });
            } else {
                await message.reply({
                    content:
                        `❌ Rule **${ruleNumber}** doesn't exist. ` +
                        `Please use a number from **1–${Object.keys(RULES).length}**.`,
                    allowedMentions: { repliedUser: false }
                });
            }

            return;
        }

        // --------------------------------------------------------
        // BAD WORD MODERATION
        // --------------------------------------------------------

        if (!containsBadWord(message.content)) return;

        const member = message.member;
        if (!member) return;

        try {
            await message.delete();
            console.log(`Deleted bad message from ${message.author.tag}`);
        } catch (error) {
            console.error("Could not delete message:", error);
            return;
        }

        const warningCount = await addWarning(
            member,
            "Using prohibited language"
        );

        try {
            await member.send(
                `⚠️ **Warning from ${message.guild.name}**\n\n` +
                `Your message was deleted because it contained prohibited language.\n\n` +
                `You now have **${warningCount}/${MAX_WARNINGS} warnings**.\n` +
                `Please keep the server respectful.`
            );
        } catch {
            console.log(`Could not DM ${member.user.tag}.`);
        }

        if (warningCount >= MAX_WARNINGS) {
            try {
                if (!member.moderatable) {
                    console.log(
                        `Cannot timeout ${member.user.tag}. Check role hierarchy and permissions.`
                    );
                    return;
                }

                await member.timeout(
                    TIMEOUT_DURATION,
                    "Reached 3 moderation warnings"
                );

                delete warnings[member.id];
                saveWarnings(warnings);

                try {
                    await member.send(
                        `🔇 You have been **timed out for 1 hour** because you reached ${MAX_WARNINGS} warnings.`
                    );
                } catch {
                    console.log("Could not DM user about timeout.");
                }
            } catch (error) {
                console.error("Timeout failed:", error);
            }
        }
    } catch (error) {
        console.error("Message handler error:", error);
    }
});

// ============================================================
// SLASH COMMANDS
// ============================================================

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

        // Public commands
        if (interaction.commandName === "rules") {
            return interaction.reply({
                embeds: [createRulesEmbed()]
            });
        }

        if (interaction.commandName === "rule") {
            const number = interaction.options.getInteger("number");

            if (!RULES[number]) {
                return interaction.reply({
                    content:
                        `❌ Rule **${number}** doesn't exist. Use **1–${Object.keys(RULES).length}**.`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [createRuleEmbed(number)]
            });
        }

        // Moderation commands below this point require staff.
        const member = interaction.member;

        if (!hasModeratorRole(member)) {
            return interaction.reply({
                content: "❌ You don't have permission to use this command.",
                ephemeral: true
            });
        }

        if (interaction.commandName === "warnings") {
            const user = interaction.options.getUser("user");
            const userWarnings = warnings[user.id] || [];

            if (userWarnings.length === 0) {
                return interaction.reply({
                    content: `✅ ${user} has no warnings.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(`⚠️ Warnings — ${user.username}`)
                .setDescription(
                    userWarnings
                        .map((warning, index) => {
                            const date = new Date(warning.timestamp);
                            return (
                                `**${index + 1}.** ${warning.reason}\n` +
                                `📅 ${date.toLocaleString()}`
                            );
                        })
                        .join("\n\n")
                )
                .setFooter({ text: `${userWarnings.length}/${MAX_WARNINGS} warnings` });

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

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

            return interaction.reply({
                content: `✅ Cleared all warnings for ${user}.`,
                ephemeral: true
            });
        }

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

            const warningCount = await addWarning(targetMember, reason);

            await interaction.reply({
                content:
                    `⚠️ Warned ${user}.\n` +
                    `Reason: **${reason}**\n` +
                    `Warnings: **${warningCount}/${MAX_WARNINGS}**`,
                ephemeral: true
            });

            try {
                await user.send(
                    `⚠️ **You received a warning in ${interaction.guild.name}.**\n\n` +
                    `Reason: **${reason}**\n` +
                    `Warnings: **${warningCount}/${MAX_WARNINGS}**`
                );
            } catch {
                console.log(`Could not DM ${user.tag}`);
            }

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
                        } catch {}

                        await interaction.followUp({
                            content:
                                `🔇 ${user} reached ${MAX_WARNINGS} warnings and has been timed out for 1 hour.`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error("Timeout failed:", error);
                }
            }
        }
    } catch (error) {
        console.error("Interaction error:", error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Something went wrong while processing that command.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ============================================================
// READY / STATUS
// ============================================================

client.once(Events.ClientReady, readyClient => {
    readyClient.user.setPresence({
        activities: [
            {
                name: BOT_STATUS,
                type: ActivityType.Playing
            }
        ],
        status: "online"
    });

    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log(`🎮 Status: Playing ${BOT_STATUS}`);
    console.log("🛡️ Moderation system is active.");
    console.log("📜 Rule lookup is active: r1? through r11?");
    console.log("⏳ Inactivity monitor is active: 2 minutes.");
});

// ============================================================
// HTTP KEEP-ALIVE
// ============================================================

const http = require("http");
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Final Tag VR Discord bot is online!");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Web server listening on port ${PORT}`);
});

// ============================================================
// LOGIN
// ============================================================

client.login(process.env.DISCORD_TOKEN);
