const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up channels and roles for the bot.')
        .addChannelOption(option =>
            option.setName('ssu_channel')
                .setDescription('The channel where SSU/SSD announcements will go.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('ping_role')
                .setDescription('The role to ping for SSU votes.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('logs_channel')
                .setDescription('The channel where bot command logs will be posted.')
                .setRequired(false)),

    async execute(interaction, client) {
        const ssuChannel = interaction.options.getChannel('ssu_channel');
        const pingRole = interaction.options.getRole('ping_role');
        const logsChannel = interaction.options.getChannel('logs_channel');

        const guildId = interaction.guild.id;

        const existing = client.settings.get(guildId) || {};

        const settingsData = {
            ssuChannelId: ssuChannel.id,
            pingRoleId: pingRole.id,
            announcementMessageId: existing.announcementMessageId || null,
        };

        if (logsChannel) {
            settingsData.logsChannelId = logsChannel.id;
        }

        // Preserve existing settings if only partially updating
        client.settings.set(guildId, { ...existing, ...settingsData });

        let replyMsg = `Setup complete!\n**SSU Channel:** ${ssuChannel}\n**Ping Role:** ${pingRole}`;
        if (logsChannel) {
            replyMsg += `\n**Logs Channel:** ${logsChannel}`;
        }

        await interaction.reply({ content: replyMsg, flags: 64 });
    },
};
