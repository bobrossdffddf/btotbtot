const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getServerInfo } = require('../api/erlc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription('Announce a Server Start Up (SSU).'),

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const settings = client.settings.get(guildId);

        if (!settings || !settings.ssuChannelId) {
            return interaction.reply({ content: 'Please configure the bot with `/setup` first.', flags: 64 });
        }

        const ssuChannel = client.channels.cache.get(settings.ssuChannelId);
        if (!ssuChannel) {
            return interaction.reply({ content: 'The configured SSU channel could not be found.', flags: 64 });
        }

        let deferred = false;
        try {
            await interaction.deferReply({ flags: 64 });
            deferred = true;
        } catch (e) {
            // Continue without deferring
        }

        const serverInfo = await getServerInfo();
        let joinCodeInfo = '';
        let playerCount = 'N/A';
        let queueCount = 'N/A';

        if (serverInfo) {
            joinCodeInfo = `Server Code: \`${serverInfo.JoinKey}\``;
            playerCount = `${serverInfo.CurrentPlayers}/${serverInfo.MaxPlayers}`;
            queueCount = serverInfo.QueuePlayers || '0';
        }

        const embed = new EmbedBuilder()
            .setTitle('Server Start Up')
            .setColor('#3498db')
            .setDescription(`We are currently hosting a Server Start Up! Come join our server and roleplay with us.\n\n${joinCodeInfo}\n**Players:** ${playerCount}\n**Queue:** ${queueCount}`)
            .setImage('https://i.postimg.cc/9Qjc6rbJ/Session-Banner.webp') // Generic banner, customizable later
            .setFooter({ text: 'Texas State Roleplay', iconURL: 'https://i.postimg.cc/9Qjc6rbJ/Session-Banner.webp' })
            .setTimestamp();

        try {
            const pingRole = settings.pingRoleId ? `<@&${settings.pingRoleId}>` : '';
            await ssuChannel.send({ content: pingRole, embeds: [embed] });
            if (deferred) {
                await interaction.editReply('SSU Announced successfully.');
            } else {
                await interaction.reply({ content: 'SSU Announced successfully.', flags: 64 });
            }
        } catch (e) {
            const msg = 'Failed to send SSU announcement. Check permissions.';
            if (deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, flags: 64 });
            }
        }
    },
};
