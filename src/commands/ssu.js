const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getServerInfo } = require('../api/erlc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription('Announce a Server Start Up (SSU).'),

    async execute(interaction, client) {
        try {
            // Always defer immediately (MUST be first)
            await interaction.deferReply({ flags: 64 });

            const guildId = interaction.guild.id;
            const settings = client.settings.get(guildId);

            if (!settings || !settings.ssuChannelId) {
                return await interaction.editReply({ content: 'Please configure the bot with `/setup` first.' });
            }

            const ssuChannel = client.channels.cache.get(settings.ssuChannelId);
            if (!ssuChannel) {
                return await interaction.editReply({ content: 'The configured SSU channel could not be found.' });
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

            const pingRole = settings.pingRoleId ? `<@&${settings.pingRoleId}>` : '';
            await ssuChannel.send({ content: pingRole, embeds: [embed] });
            await interaction.editReply('SSU Announced successfully.');
        } catch (e) {
            console.error('[SSU] Error:', e.message);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to send SSU announcement. Check permissions.', flags: 64 });
                } else if (interaction.deferred) {
                    await interaction.editReply({ content: 'Failed to send SSU announcement. Check permissions.' });
                }
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError.message);
            }
        }
    },
};
