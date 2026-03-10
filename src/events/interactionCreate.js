const { Events, EmbedBuilder } = require('discord.js');

const OWNER_ID = '848356730256883744';
const REQUIRED_ROLE_ID = '1284692654504022118';
const OWNER_ONLY_COMMANDS = ['git'];

const log = (level, command, message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [CMD:${command}] ${message}`);
};

const sendSafeReply = async (interaction, content, flags = 64) => {
    try {
        if (!interaction.isRepliable()) {
            log('WARN', interaction.commandName, 'Interaction is not repliable');
            return;
        }

        if (interaction.replied) {
            await interaction.followUp({ content, flags });
        } else if (interaction.deferred) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, flags });
        }
    } catch (error) {
        if (error.code === 10062) {
            log('ERROR', interaction.commandName, `Interaction expired (Unknown interaction error): ${error.message}`);
        } else {
            log('ERROR', interaction.commandName, `Failed to send reply: ${error.message}`);
        }
    }
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                const timestamp = new Date().toLocaleString();
                const user = interaction.user;
                const channel = interaction.channel;
                const options = interaction.options.data.map(o => `${o.name}:${o.value}`).join(', ') || 'none';

                // Permission check
                const isOwnerOnlyCommand = OWNER_ONLY_COMMANDS.includes(interaction.commandName);

                try {
                    if (isOwnerOnlyCommand) {
                        // Owner-only commands (git)
                        if (interaction.user.id !== OWNER_ID) {
                            log('WARN', interaction.commandName, `Permission denied for ${user.tag} (${user.id}) - owner-only command`);
                            return await sendSafeReply(interaction, 'Only the bot owner can use this command.');
                        }
                    } else {
                        // All other commands require the role
                        if (!interaction.member || !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
                            log('WARN', interaction.commandName, `Permission denied for ${user.tag} (${user.id}) - missing required role ${REQUIRED_ROLE_ID}`);
                            return await sendSafeReply(interaction, `You need the required role to use this command. Required role: <@&${REQUIRED_ROLE_ID}>`);
                        }
                    }
                } catch (permError) {
                    log('ERROR', interaction.commandName, `Permission check failed: ${permError.message}`);
                    return await sendSafeReply(interaction, 'An error occurred while checking permissions.');
                }

                if (!command) {
                    log('ERROR', interaction.commandName, `Command not found`);
                    return;
                }

                log('INFO', interaction.commandName, `Executed by ${user.tag} (${user.id}) in #${channel?.name || 'DM'} | options: ${options}`);

                // DM owner
                try {
                    const owner = await client.users.fetch(OWNER_ID);
                    if (owner) {
                        await owner.send(`**Command Run**\n\`/${interaction.commandName}\` by **${user.tag}** in **#${channel?.name || 'DM'}**\nOptions: ${options}\nTime: ${timestamp}`);
                    }
                } catch (e) {
                    log('WARN', interaction.commandName, `Failed to send owner DM: ${e.message}`);
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
                    log('WARN', interaction.commandName, `Failed to log to channel: ${e.message}`);
                }

                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    log('ERROR', interaction.commandName, `Execution failed: ${error.message}\n${error.stack}`);
                    await sendSafeReply(interaction, 'There was an error while executing this command!');
                }
            }
        } catch (error) {
            log('ERROR', 'InteractionCreate', `Unhandled error: ${error.message}\n${error.stack}`);
        }
    },
};
