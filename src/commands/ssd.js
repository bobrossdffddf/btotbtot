const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { runCommand } = require('../api/erlc');
const { upsertAnnouncementMessage } = require('../utils/announcementMessage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssd')
        .setDescription('Announce a Server Shutdown (SSD).'),

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

            const announcementMessageId = settings.announcementMessageId;

            const embed = new EmbedBuilder()
                .setTitle('Server Shutdown')
                .setColor('#2C2F33')
                .setDescription('We would like to thank everyone that has came to our server to roleplay, but we will be shutting down our community for the time being. Check this channel again for more information on our next start up.')
                .setImage('https://i.postimg.cc/t4H9KYkk/Session-Shut-Down-Banner.webp')
                .setFooter({ text: 'Texas State Roleplay' })
                .setTimestamp();

            await upsertAnnouncementMessage({
                client,
                guildId,
                channel: ssuChannel,
                embeds: [embed],
                announcementMessageId,
            });

            // Run :shutdown command in ERLC
            const shutdownResult = await runCommand(':shutdown');
            let msg;
            if (shutdownResult !== null) {
                console.log('[SSD] :shutdown command sent to ERLC server.');
                msg = 'SSD Announced successfully and `:shutdown` sent to the ERLC server.';
            } else {
                msg = 'SSD Announced successfully, but failed to send `:shutdown` to ERLC. Check the API key.';
            }
            await interaction.editReply(msg);
        } catch (e) {
            console.error('[SSD] Error:', e.message);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to send SSD announcement. Check permissions.', flags: 64 });
                } else if (interaction.deferred) {
                    await interaction.editReply({ content: 'Failed to send SSD announcement. Check permissions.' });
                }
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError.message);
            }
        }
    },
};
