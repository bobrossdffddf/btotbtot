const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { runCommand } = require('../api/erlc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssd')
        .setDescription('Announce a Server Shutdown (SSD).'),

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

        const embed = new EmbedBuilder()
            .setTitle('Server Shutdown')
            .setColor('#2C2F33')
            .setDescription('We would like to thank everyone that has came to our server to roleplay, but we will be shutting down our community for the time being. Check this channel again for more information on our next start up.')
            .setImage('https://i.postimg.cc/t4H9KYkk/Session-Shut-Down-Banner.webp')
            .setFooter({ text: 'Texas State Roleplay' })
            .setTimestamp();

        try {
            await ssuChannel.send({ embeds: [embed] });

            // Run :shutdown command in ERLC
            const shutdownResult = await runCommand(':shutdown');
            let msg;
            if (shutdownResult !== null) {
                console.log('[SSD] :shutdown command sent to ERLC server.');
                msg = 'SSD Announced successfully and `:shutdown` sent to the ERLC server.';
            } else {
                msg = 'SSD Announced successfully, but failed to send `:shutdown` to ERLC. Check the API key.';
            }
            if (deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, flags: 64 });
            }
        } catch (e) {
            console.error('[SSD] Error:', e.message);
            const msg = 'Failed to send SSD announcement. Check permissions.';
            if (deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, flags: 64 });
            }
        }
    },
};
