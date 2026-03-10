const { Events, EmbedBuilder } = require('discord.js');

const OWNER_ID = '848356730256883744';
const REQUIRED_ROLE_ID = '1284692654504022118';
const OWNER_ONLY_COMMANDS = ['git'];

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            // Permission check
            const isOwnerOnlyCommand = OWNER_ONLY_COMMANDS.includes(interaction.commandName);
            
            if (isOwnerOnlyCommand) {
                // Owner-only commands (git)
                if (interaction.user.id !== OWNER_ID) {
                    return interaction.reply({ content: 'Only the bot owner can use this command.', flags: 64 });
                }
            } else {
                // All other commands require the role
                if (!interaction.member || !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
                    return interaction.reply({ content: `You need the required role to use this command. Required role: <@&${REQUIRED_ROLE_ID}>`, flags: 64 });
                }
            }

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
