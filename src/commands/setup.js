const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { parseConfiguredRoleIds } = require('./citation');
const { isLeoGuild } = require('../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up channels, roles, and citation configuration for the bot.')
        .addChannelOption(option =>
            option.setName('ssu_channel')
                .setDescription('The channel where SSU/SSD announcements will go.')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('ping_role')
                .setDescription('The role to ping for SSU votes.')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('logs_channel')
                .setDescription('The channel where bot command logs will be posted.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('citation_roles')
                .setDescription('Comma-separated role IDs (or mentions) allowed to create citations.')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('citation_logs')
                .setDescription('Channel where citation logs will be posted.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('citation_economy_guild_id')
                .setDescription('Main server guild ID where UnbelievaBoat economy deductions happen.')
                .setRequired(false)),

    async execute(interaction, client) {
        if (!isLeoGuild(interaction.guild.id)) {
            return interaction.reply({ content: '`/setup` is only enabled in configured LEO guilds.', flags: 64 });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Only administrators can use /setup.', flags: 64 });
        }

        const ssuChannel = interaction.options.getChannel('ssu_channel');
        const pingRole = interaction.options.getRole('ping_role');
        const logsChannel = interaction.options.getChannel('logs_channel');
        const citationRolesInput = interaction.options.getString('citation_roles');
        const citationLogsChannel = interaction.options.getChannel('citation_logs');
        const citationEconomyGuildId = interaction.options.getString('citation_economy_guild_id');

        const guildId = interaction.guild.id;
        const existing = client.settings.get(guildId) || {};

        const settingsData = {
            announcementMessageId: existing.announcementMessageId || null,
        };

        if (ssuChannel) settingsData.ssuChannelId = ssuChannel.id;
        if (pingRole) settingsData.pingRoleId = pingRole.id;
        if (logsChannel) settingsData.logsChannelId = logsChannel.id;
        if (citationLogsChannel) settingsData.citationLogsChannelId = citationLogsChannel.id;

        if (citationRolesInput) {
            const parsedRoles = parseConfiguredRoleIds(citationRolesInput);
            settingsData.allowedCitationRoleIds = parsedRoles;
        }

        if (citationEconomyGuildId) {
            if (!/^\d{17,20}$/.test(citationEconomyGuildId)) {
                return interaction.reply({ content: 'citation_economy_guild_id must be a valid Discord guild ID.', flags: 64 });
            }
            settingsData.citationEconomyGuildId = citationEconomyGuildId;
        }

        client.settings.set(guildId, { ...existing, ...settingsData });

        const updated = client.settings.get(guildId);
        const allowedCitationRoles = (updated.allowedCitationRoleIds || []).map(roleId => `<@&${roleId}>`).join(', ') || 'Not configured';

        const replyLines = [
            'Setup complete!',
            `**SSU Channel:** ${updated.ssuChannelId ? `<#${updated.ssuChannelId}>` : 'Not configured'}`,
            `**Ping Role:** ${updated.pingRoleId ? `<@&${updated.pingRoleId}>` : 'Not configured'}`,
            `**Logs Channel:** ${updated.logsChannelId ? `<#${updated.logsChannelId}>` : 'Not configured'}`,
            `**Citation Roles:** ${allowedCitationRoles}`,
            `**Citation Logs Channel:** ${updated.citationLogsChannelId ? `<#${updated.citationLogsChannelId}>` : 'Not configured'}`,
            `**Citation Economy Guild ID:** ${updated.citationEconomyGuildId || 'Current guild'}`
        ];

        await interaction.reply({ content: replyLines.join('\n'), flags: 64 });
    },
};
