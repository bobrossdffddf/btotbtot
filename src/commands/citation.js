const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { editUserBalance, getUserBalance } = require('../api/unbelievaboat');
const { isLeoGuild, isMainGuild } = require('../utils/guildConfig');

const MAX_FINE_AMOUNT = 10_000_000;

const buildCitationData = ({ includeCreate = true, includeLookup = true } = {}) => {
    const builder = new SlashCommandBuilder()
        .setName('citation')
        .setDescription('Create or lookup police citations tied to UnbelievaBoat economy.');

    if (includeCreate) {
        builder.addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Issue a citation and deduct the fine from the target\'s economy balance.')
                .addStringOption(option =>
                    option
                        .setName('target_user_id')
                        .setDescription('Target user\'s Discord ID to fine.')
                        .setRequired(true)));
    }

    if (includeLookup) {
        builder.addSubcommand(subcommand =>
            subcommand
                .setName('lookup')
                .setDescription('Lookup all citations on record for a user.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to look up citations for.')
                        .setRequired(true)));
    }

    return builder;
};

const parseConfiguredRoleIds = (value) => {
    if (!value || typeof value !== 'string') return [];

    return value
        .split(',')
        .map(role => role.trim().replace(/[<@&>]/g, ''))
        .filter(id => /^\d{17,20}$/.test(id));
};

const hasCitationPermission = (interaction, settings) => {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (isAdmin) return true;

    const allowedRoleIds = settings.allowedCitationRoleIds || [];
    if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) return false;

    return allowedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
};

const formatFine = (amount) => `$${Number(amount).toLocaleString('en-US')}`;

const generateCitationId = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `CIT-${ts}-${rand}`;
};

module.exports = {
    data: buildCitationData({ includeCreate: true, includeLookup: true }),

    buildCitationData,

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = client.settings.get(interaction.guild.id) || {};

        if (subcommand === 'create') {
            if (!isLeoGuild(interaction.guild.id)) {
                return interaction.reply({
                    content: '`/citation create` is only available in configured LEO guilds.',
                    flags: 64
                });
            }

            if (!hasCitationPermission(interaction, guildSettings)) {
                return interaction.reply({
                    content: 'You do not have permission to issue citations. Contact an administrator to configure citation roles via `/setup`.',
                    flags: 64
                });
            }

            const targetUserId = interaction.options.getString('target_user_id', true).trim();
            if (!/^\d{17,20}$/.test(targetUserId)) {
                return interaction.reply({
                    content: 'Please provide a valid Discord user ID (17–20 digits).',
                    flags: 64
                });
            }

            if (targetUserId === interaction.user.id) {
                return interaction.reply({
                    content: 'You cannot issue a citation to yourself.',
                    flags: 64
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`citation-create:${targetUserId}`)
                .setTitle('Issue Citation');

            const violationInput = new TextInputBuilder()
                .setCustomId('violation_name')
                .setLabel('Violation (include penal code)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setPlaceholder('e.g. PC 187 - Reckless Driving');

            const eventDescriptionInput = new TextInputBuilder()
                .setCustomId('event_description')
                .setLabel('Description of event')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
                .setPlaceholder('Describe what happened during the incident.');

            const carDescriptionInput = new TextInputBuilder()
                .setCustomId('car_description')
                .setLabel('Description of vehicle')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500)
                .setPlaceholder('e.g. Red 2021 Ford Mustang, License Plate: ABC-123');

            const personDescriptionInput = new TextInputBuilder()
                .setCustomId('person_description')
                .setLabel('Description of person(s)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500)
                .setPlaceholder('e.g. Male, black jacket, jeans, brown hair.');

            const fineAmountInput = new TextInputBuilder()
                .setCustomId('fine_amount')
                .setLabel(`Fine amount (max ${formatFine(MAX_FINE_AMOUNT)})`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('e.g. 5000');

            modal.addComponents(
                new ActionRowBuilder().addComponents(violationInput),
                new ActionRowBuilder().addComponents(eventDescriptionInput),
                new ActionRowBuilder().addComponents(carDescriptionInput),
                new ActionRowBuilder().addComponents(personDescriptionInput),
                new ActionRowBuilder().addComponents(fineAmountInput)
            );

            return interaction.showModal(modal);
        }

        if (subcommand === 'lookup') {
            if (!isMainGuild(interaction.guild.id)) {
                return interaction.reply({
                    content: '`/citation lookup` is only available in the configured main guild.',
                    flags: 64
                });
            }

            const user = interaction.options.getUser('user', true);
            const allCitations = client.citations.get(user.id) || [];

            if (allCitations.length === 0) {
                return interaction.reply({
                    content: `No citations found for ${user}.`,
                    flags: 64
                });
            }

            const latest = allCitations.slice(-10).reverse();
            const description = latest
                .map((citation, index) => {
                    const date = new Date(citation.createdAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    });
                    return [
                        `**[${index + 1}] ${citation.citationId}**`,
                        `> **Date:** ${date}`,
                        `> **Violation:** ${citation.violationName}`,
                        `> **Fine:** ${formatFine(citation.fineAmount)}`,
                        `> **Issued by:** <@${citation.issuedBy}>`,
                        `> **Source Server:** ${citation.sourceGuildName}`
                    ].join('\n');
                })
                .join('\n\n');

            const totalFines = allCitations.reduce((sum, c) => sum + (c.fineAmount || 0), 0);

            const embed = new EmbedBuilder()
                .setTitle(`📋 Citation Record: ${user.username}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(description)
                .setColor(0xED4245)
                .addFields(
                    { name: 'Total Citations', value: String(allCitations.length), inline: true },
                    { name: 'Total Fines Issued', value: formatFine(totalFines), inline: true }
                )
                .setFooter({ text: `Showing ${latest.length} most recent of ${allCitations.length} total citations` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
        }
    },

    async handleModalSubmit(interaction, client) {
        if (!interaction.customId.startsWith('citation-create:')) return;

        if (!isLeoGuild(interaction.guild.id)) {
            return interaction.reply({
                content: 'Citation creation is only available in configured LEO guilds.',
                flags: 64
            });
        }

        const guildSettings = client.settings.get(interaction.guild.id) || {};

        if (!hasCitationPermission(interaction, guildSettings)) {
            return interaction.reply({
                content: 'You do not have permission to issue citations. Contact an administrator to configure citation roles via `/setup`.',
                flags: 64
            });
        }

        const targetUserId = interaction.customId.split(':')[1];

        const violationName = interaction.fields.getTextInputValue('violation_name').trim();
        const eventDescription = interaction.fields.getTextInputValue('event_description').trim();
        const carDescription = interaction.fields.getTextInputValue('car_description').trim();
        const personDescription = interaction.fields.getTextInputValue('person_description').trim();
        const fineInput = interaction.fields.getTextInputValue('fine_amount').trim().replace(/[$,\s]/g, '');

        const fineAmount = Number(fineInput);

        if (!Number.isFinite(fineAmount) || !Number.isInteger(fineAmount) || fineAmount <= 0) {
            return interaction.reply({
                content: 'Fine amount must be a whole positive number (e.g. `5000`).',
                flags: 64
            });
        }

        if (fineAmount > MAX_FINE_AMOUNT) {
            return interaction.reply({
                content: `Fine amount of ${formatFine(fineAmount)} exceeds the maximum allowed cap of ${formatFine(MAX_FINE_AMOUNT)}.`,
                flags: 64
            });
        }

        // Default economy guild is the configured main guild for this LEO server.
        // Admins can override per-server via /setup citation_economy_guild_id.
        const economyGuildId = guildSettings.citationEconomyGuildId;
        if (!economyGuildId) {
            return interaction.reply({
                content: 'This server has not been configured with an economy guild ID yet. An administrator must run `/setup` and set the `citation_economy_guild_id` to your main server\'s guild ID.',
                flags: 64
            });
        }

        const reason = `Citation by ${interaction.user.username} (${interaction.user.id}): ${violationName}`;

        await interaction.deferReply({ flags: 64 });

        try {
            let currentBalance;
            try {
                currentBalance = await getUserBalance(economyGuildId, targetUserId);
            } catch (balanceError) {
                const status = balanceError.response?.status;
                if (status === 404) {
                    return interaction.editReply({
                        content: `User <@${targetUserId}> was not found in the economy server (\`${economyGuildId}\`). They may not have an account yet.`
                    });
                }
                if (status === 401 || status === 403) {
                    return interaction.editReply({
                        content: 'The UnbelievaBoat API key is invalid or lacks permissions for that server. Please contact the bot administrator.'
                    });
                }
                throw balanceError;
            }

            const availableCash = Number(currentBalance.cash || 0);

            if (availableCash < fineAmount) {
                return interaction.editReply({
                    content: `Cannot issue citation: <@${targetUserId}> only has ${formatFine(availableCash)} in cash, but the fine is ${formatFine(fineAmount)}. Reduce the fine or handle this manually.`
                });
            }

            const updatedBalance = await editUserBalance(
                economyGuildId,
                targetUserId,
                { cash: -fineAmount },
                reason
            );

            const citation = {
                citationId: generateCitationId(),
                targetUserId,
                issuedBy: interaction.user.id,
                issuedByUsername: interaction.user.username,
                sourceGuildId: interaction.guild.id,
                sourceGuildName: interaction.guild.name,
                economyGuildId,
                violationName,
                eventDescription,
                carDescription,
                personDescription,
                fineAmount,
                beforeCash: availableCash,
                afterCash: Number(updatedBalance.cash ?? 0),
                createdAt: new Date().toISOString()
            };

            const existing = client.citations.get(targetUserId) || [];
            existing.push(citation);
            client.citations.set(targetUserId, existing);

            const citationEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🚔 Citation Issued')
                .addFields(
                    { name: 'Citation ID', value: citation.citationId, inline: true },
                    { name: 'Target', value: `<@${targetUserId}>`, inline: true },
                    { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Violation', value: violationName },
                    { name: 'Event Description', value: eventDescription },
                    { name: 'Vehicle Description', value: carDescription },
                    { name: 'Person Description', value: personDescription },
                    { name: 'Fine Amount', value: formatFine(fineAmount), inline: true },
                    { name: 'Balance Before', value: formatFine(availableCash), inline: true },
                    { name: 'Balance After', value: formatFine(citation.afterCash), inline: true }
                )
                .setFooter({ text: `Issued in ${interaction.guild.name} • Economy server: ${economyGuildId}` })
                .setTimestamp();

            const logsChannelId = guildSettings.citationLogsChannelId;
            if (logsChannelId) {
                const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    logsChannel.send({ embeds: [citationEmbed] }).catch(err => {
                        console.error(`[CITATION] Failed to send to logs channel: ${err.message}`);
                    });
                }
            }

            return interaction.editReply({
                content: `Citation **${citation.citationId}** successfully issued for <@${targetUserId}>. ${formatFine(fineAmount)} has been deducted from their cash balance.`,
                embeds: [citationEmbed]
            });

        } catch (error) {
            const status = error.response?.status;
            const detail = error.response?.data?.message || error.message;
            console.error(`[CITATION] Failed to process citation: ${error.message}`, error.response?.data);

            let userMessage = 'Failed to process the citation. Please try again.';
            if (status === 401 || status === 403) {
                userMessage = 'The UnbelievaBoat API key is invalid or missing permissions. Contact the bot administrator.';
            } else if (status === 404) {
                userMessage = `User <@${targetUserId}> was not found in the economy server (\`${economyGuildId}\`).`;
            } else if (status >= 500) {
                userMessage = 'The UnbelievaBoat API is experiencing issues. Please try again in a moment.';
            } else if (detail) {
                userMessage = `Citation failed: ${detail}`;
            }

            return interaction.editReply({ content: userMessage });
        }
    },

    parseConfiguredRoleIds
};
