const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { parseConfiguredRoleIds } = require('./citation');
const { isLeoGuild } = require('../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('(Admin only) Configure this LEO server\'s citation and announcement settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option
                .setName('citation_logs')
                .setDescription('Channel where citation logs will be posted after each ticket is issued.')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('citation_roles')
                .setDescription('Comma-separated role IDs (or @mentions) allowed to issue citations.')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('citation_economy_guild_id')
                .setDescription('Main server guild ID where UnbelievaBoat economy fines are deducted from.')
                .setRequired(false))
        .addChannelOption(option =>
            option
                .setName('ssu_channel')
                .setDescription('Channel where SSU/SSD session announcements are sent.')
                .setRequired(false))
        .addRoleOption(option =>
            option
                .setName('ping_role')
                .setDescription('Role to ping when an SSU vote is started.')
                .setRequired(false))
        .addChannelOption(option =>
            option
                .setName('logs_channel')
                .setDescription('Channel where general bot command logs are posted.')
                .setRequired(false)),

    async execute(interaction, client) {
        if (!isLeoGuild(interaction.guild.id)) {
            return interaction.reply({
                content: '`/setup` is only available in configured LEO guilds.',
                flags: 64
            });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'Only server administrators can use `/setup`.',
                flags: 64
            });
        }

        const citationLogsChannel = interaction.options.getChannel('citation_logs');
        const citationRolesInput = interaction.options.getString('citation_roles');
        const citationEconomyGuildId = interaction.options.getString('citation_economy_guild_id');
        const ssuChannel = interaction.options.getChannel('ssu_channel');
        const pingRole = interaction.options.getRole('ping_role');
        const logsChannel = interaction.options.getChannel('logs_channel');

        const nothingProvided = !citationLogsChannel && !citationRolesInput && !citationEconomyGuildId
            && !ssuChannel && !pingRole && !logsChannel;

        if (nothingProvided) {
            const existing = client.settings.get(interaction.guild.id) || {};
            const allowedRoles = (existing.allowedCitationRoleIds || []).map(id => `<@&${id}>`).join(', ') || 'Not configured';

            const statusEmbed = new EmbedBuilder()
                .setTitle('Current Server Configuration')
                .setColor(0x5865F2)
                .addFields(
                    { name: '📋 Citation Logs Channel', value: existing.citationLogsChannelId ? `<#${existing.citationLogsChannelId}>` : 'Not configured', inline: true },
                    { name: '🏛️ Citation Economy Guild ID', value: existing.citationEconomyGuildId || 'Not configured', inline: true },
                    { name: '👮 Citation Roles', value: allowedRoles },
                    { name: '📢 SSU Channel', value: existing.ssuChannelId ? `<#${existing.ssuChannelId}>` : 'Not configured', inline: true },
                    { name: '🔔 Ping Role', value: existing.pingRoleId ? `<@&${existing.pingRoleId}>` : 'Not configured', inline: true },
                    { name: '📝 Logs Channel', value: existing.logsChannelId ? `<#${existing.logsChannelId}>` : 'Not configured', inline: true }
                )
                .setFooter({ text: 'Run /setup with options to update any of these settings.' })
                .setTimestamp();

            return interaction.reply({ embeds: [statusEmbed], flags: 64 });
        }

        const guildId = interaction.guild.id;
        const existing = client.settings.get(guildId) || {};
        const updates = {};

        if (citationLogsChannel) {
            updates.citationLogsChannelId = citationLogsChannel.id;
        }

        if (citationRolesInput) {
            const parsedRoles = parseConfiguredRoleIds(citationRolesInput);
            if (parsedRoles.length === 0) {
                return interaction.reply({
                    content: 'No valid role IDs found in `citation_roles`. Provide comma-separated role IDs or @role mentions.',
                    flags: 64
                });
            }
            updates.allowedCitationRoleIds = parsedRoles;
        }

        if (citationEconomyGuildId) {
            const cleanId = citationEconomyGuildId.trim();
            if (!/^\d{17,20}$/.test(cleanId)) {
                return interaction.reply({
                    content: '`citation_economy_guild_id` must be a valid Discord guild ID (17–20 digit number).',
                    flags: 64
                });
            }
            updates.citationEconomyGuildId = cleanId;
        }

        if (ssuChannel) updates.ssuChannelId = ssuChannel.id;
        if (pingRole) updates.pingRoleId = pingRole.id;
        if (logsChannel) updates.logsChannelId = logsChannel.id;

        client.settings.set(guildId, { ...existing, ...updates });
        const saved = client.settings.get(guildId);

        const allowedRoles = (saved.allowedCitationRoleIds || []).map(id => `<@&${id}>`).join(', ') || 'Not configured';

        const resultEmbed = new EmbedBuilder()
            .setTitle('✅ Setup Updated')
            .setColor(0x57F287)
            .addFields(
                { name: '📋 Citation Logs Channel', value: saved.citationLogsChannelId ? `<#${saved.citationLogsChannelId}>` : 'Not configured', inline: true },
                { name: '🏛️ Citation Economy Guild ID', value: saved.citationEconomyGuildId || 'Not configured', inline: true },
                { name: '👮 Citation Roles', value: allowedRoles },
                { name: '📢 SSU Channel', value: saved.ssuChannelId ? `<#${saved.ssuChannelId}>` : 'Not configured', inline: true },
                { name: '🔔 Ping Role', value: saved.pingRoleId ? `<@&${saved.pingRoleId}>` : 'Not configured', inline: true },
                { name: '📝 Logs Channel', value: saved.logsChannelId ? `<#${saved.logsChannelId}>` : 'Not configured', inline: true }
            )
            .setFooter({ text: `Updated by ${interaction.user.username}` })
            .setTimestamp();

        return interaction.reply({ embeds: [resultEmbed], flags: 64 });
    },
};
