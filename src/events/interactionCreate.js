const { Events, EmbedBuilder } = require('discord.js');

const OWNER_ID = '848356730256883744';

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

        if (interaction.isChatInputCommand()) {
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: 'Only the bot owner can use slash commands.', flags: 64 });
            }
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`[CMD] No command matching /${interaction.commandName} was found.`);
                return;
            }

            // Verbose console log
            const timestamp = new Date().toLocaleString();
            const user = interaction.user;
            const channel = interaction.channel;
            const options = interaction.options.data.map(o => `${o.name}:${o.value}`).join(', ') || 'none';
            console.log(`[CMD] ${timestamp} | /${interaction.commandName} | by ${user.tag} (${user.id}) | in #${channel?.name || 'DM'} | options: ${options}`);

            // DM owner
            try {
                const owner = await client.users.fetch(OWNER_ID);
                if (owner) {
                    await owner.send(`**Command Run**\n\`/${interaction.commandName}\` by **${user.tag}** in **#${channel?.name || 'DM'}**\nOptions: ${options}\nTime: ${timestamp}`);
                }
            } catch (e) {
                // Silently fail if DM can't be sent
            }

            // Log to logs channel if configured
            try {
                const settings = client.settings.get(interaction.guild?.id);
                if (settings && settings.logsChannelId) {
                    const logsChannel = client.channels.cache.get(settings.logsChannelId);
                    if (logsChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Command Log')
                            .setColor('#5865F2')
                            .addFields(
                                { name: 'Command', value: `\`/${interaction.commandName}\``, inline: true },
                                { name: 'User', value: `${user} (${user.tag})`, inline: true },
                                { name: 'Channel', value: `${channel || 'DM'}`, inline: true }
                            )
                            .setTimestamp();

                        if (options !== 'none') {
                            logEmbed.addFields({ name: 'Options', value: `\`${options}\`` });
                        }

                        await logsChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (e) {
                // Silently fail
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`[CMD] Error in /${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
                }
            }
        }
    },
};
