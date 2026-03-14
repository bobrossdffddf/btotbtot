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
                .setDescription('Create a citation and charge the target in the configured economy server.')
                .addStringOption(option =>
                    option
                        .setName('target_user_id')
                        .setDescription('Target user Discord ID to fine.')
                        .setRequired(true)));
    }

    if (includeLookup) {
        builder.addSubcommand(subcommand =>
            subcommand
                .setName('lookup')
                .setDescription('Lookup citations for a user.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to lookup citations for.')
                        .setRequired(true)));
    }

    return builder;
};

const parseConfiguredRoleIds = (value) => {
    if (!value || typeof value !== 'string') return [];

    return value
        .split(',')
        .map(role => role.trim().replace(/[<@&>]/g, ''))
        .filter(Boolean);
};

const hasCitationPermission = (interaction, settings) => {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (isAdmin) return true;

    const allowedRoleIds = settings.allowedCitationRoleIds || [];
    if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) return false;

    return allowedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
};

const formatFine = (amount) => `$${Number(amount).toLocaleString('en-US')}`;

module.exports = {
    data: buildCitationData({ includeCreate: true, includeLookup: true }),

    buildCitationData,

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = client.settings.get(interaction.guild.id) || {};

        if (subcommand === 'create') {
            if (!isLeoGuild(interaction.guild.id)) {
                return interaction.reply({ content: '`/citation create` is only enabled in configured LEO guilds.', flags: 64 });
            }

            if (!hasCitationPermission(interaction, guildSettings)) {
                return interaction.reply({
                    content: 'You are not allowed to create citations. Ask an admin to configure allowed citation roles in `/setup`.',
                    flags: 64
                });
            }

            const targetUserId = interaction.options.getString('target_user_id', true).trim();
            if (!/^\d{17,20}$/.test(targetUserId)) {
                return interaction.reply({ content: 'Please provide a valid Discord user ID.', flags: 64 });
            }

            const modal = new ModalBuilder()
                .setCustomId(`citation-create:${targetUserId}`)
                .setTitle('Create Citation');

            const violationInput = new TextInputBuilder()
                .setCustomId('violation_name')
                .setLabel('Violation name (include penal code)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);

            const eventDescriptionInput = new TextInputBuilder()
                .setCustomId('event_description')
                .setLabel('Description of event')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

            const carDescriptionInput = new TextInputBuilder()
                .setCustomId('car_description')
                .setLabel('Description of car')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500);

            const personDescriptionInput = new TextInputBuilder()
                .setCustomId('person_description')
                .setLabel('Description of person(s)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500);

            const fineAmountInput = new TextInputBuilder()
                .setCustomId('fine_amount')
                .setLabel(`Fine amount (max ${MAX_FINE_AMOUNT})`)
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
                return interaction.reply({ content: '`/citation lookup` is only enabled in the configured main guild.', flags: 64 });
            }

            const user = interaction.options.getUser('user', true);
            const allCitations = client.citations.get(user.id) || [];
            const relevant = allCitations.filter(citation => citation.targetUserId === user.id);

            if (relevant.length === 0) {
                return interaction.reply({ content: `No citations found for ${user}.`, flags: 64 });
            }

            const latest = relevant.slice(-10).reverse();
            const description = latest
                .map(citation => {
                    const date = new Date(citation.createdAt).toLocaleString();
                    return [
                        `**Citation ID:** ${citation.citationId}`,
                        `**Date:** ${date}`,
                        `**Violation:** ${citation.violationName}`,
                        `**Fine:** ${formatFine(citation.fineAmount)}`,
                        `**Issued by:** <@${citation.issuedBy}>`,
                        `**Source Guild:** ${citation.sourceGuildName}`
                    ].join('\n');
                })
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(`Citation Lookup: ${user.tag}`)
                .setDescription(description)
                .setColor(0x2B2D31)
                .setFooter({ text: `Showing ${latest.length} of ${relevant.length} citations` });

            return interaction.reply({ embeds: [embed], flags: 64 });
        }
    },

    async handleModalSubmit(interaction, client) {
        if (!interaction.customId.startsWith('citation-create:')) return;

        if (!isLeoGuild(interaction.guild.id)) {
            return interaction.reply({ content: 'Citation creation form is only enabled in configured LEO guilds.', flags: 64 });
        }

        const targetUserId = interaction.customId.split(':')[1];
        const guildSettings = client.settings.get(interaction.guild.id) || {};

        if (!hasCitationPermission(interaction, guildSettings)) {
            return interaction.reply({
                content: 'You are not allowed to create citations. Ask an admin to configure allowed citation roles in `/setup`.',
                flags: 64
            });
        }

        const violationName = interaction.fields.getTextInputValue('violation_name').trim();
        const eventDescription = interaction.fields.getTextInputValue('event_description').trim();
        const carDescription = interaction.fields.getTextInputValue('car_description').trim();
        const personDescription = interaction.fields.getTextInputValue('person_description').trim();
        const fineInput = interaction.fields.getTextInputValue('fine_amount').trim().replace(/[$,\s]/g, '');

        const fineAmount = Number(fineInput);
        if (!Number.isFinite(fineAmount) || !Number.isInteger(fineAmount) || fineAmount <= 0) {
            return interaction.reply({ content: 'Fine amount must be a whole number greater than 0.', flags: 64 });
        }

        if (fineAmount > MAX_FINE_AMOUNT) {
            return interaction.reply({ content: `Fine amount exceeds cap of ${formatFine(MAX_FINE_AMOUNT)}.`, flags: 64 });
        }

        const economyGuildId = guildSettings.citationEconomyGuildId || interaction.guild.id;
        const reason = `Citation issued by ${interaction.user.tag}: ${violationName}`;

        try {
            const currentBalance = await getUserBalance(economyGuildId, targetUserId);
            const availableCash = Number(currentBalance.cash || 0);

            if (availableCash < fineAmount) {
                return interaction.reply({
                    content: `Citation not processed. Target only has ${formatFine(availableCash)} cash, but fine is ${formatFine(fineAmount)}.`,
                    flags: 64
                });
            }

            const updatedBalance = await editUserBalance(economyGuildId, targetUserId, { cash: -fineAmount }, reason);

            const citation = {
                citationId: `CIT-${Date.now().toString(36).toUpperCase()}`,
                targetUserId,
                issuedBy: interaction.user.id,
                sourceGuildId: interaction.guild.id,
                sourceGuildName: interaction.guild.name,
                economyGuildId,
                violationName,
                eventDescription,
                carDescription,
                personDescription,
                fineAmount,
                beforeCash: availableCash,
                afterCash: Number(updatedBalance.cash || 0),
                createdAt: new Date().toISOString()
            };

            const citations = client.citations.get(targetUserId) || [];
            citations.push(citation);
            client.citations.set(targetUserId, citations);

            const citationEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Citation Issued')
                .addFields(
                    { name: 'Citation ID', value: citation.citationId, inline: true },
                    { name: 'Target User ID', value: targetUserId, inline: true },
                    { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Violation', value: violationName },
                    { name: 'Event Description', value: eventDescription },
                    { name: 'Car Description', value: carDescription },
                    { name: 'Person Description', value: personDescription },
                    { name: 'Fine Amount', value: formatFine(fineAmount), inline: true },
                    { name: 'Cash Before', value: formatFine(availableCash), inline: true },
                    { name: 'Cash After', value: formatFine(updatedBalance.cash || 0), inline: true }
                )
                .setTimestamp();

            const logsChannelId = guildSettings.citationLogsChannelId;
            if (logsChannelId) {
                const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
                if (logsChannel) {
                    await logsChannel.send({ embeds: [citationEmbed] });
                }
            }

            return interaction.reply({
                content: `Citation created successfully for <@${targetUserId}>. ${formatFine(fineAmount)} has been removed from their cash balance in guild \`${economyGuildId}\`.`,
                embeds: [citationEmbed],
                flags: 64
            });
        } catch (error) {
            console.error(`[CITATION] Failed to process citation: ${error.message}`);
            return interaction.reply({
                content: 'Failed to process citation with UnbelievaBoat API. Please verify API key permissions, configured guild ID, and target user account.',
                flags: 64
            });
        }
    },

    parseConfiguredRoleIds
};
