const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const OWNER_ID = '848356730256883744';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('git')
        .setDescription('Git management commands (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('restart')
                .setDescription('Pull latest changes and restart PM2'))
        .addSubcommand(subcommand =>
            subcommand.setName('stash')
                .setDescription('Stash current changes'))
        .addSubcommand(subcommand =>
            subcommand.setName('v')
                .setDescription('Show git version and last commit')),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const logFile = path.join(process.cwd(), 'git_commands.log');

        try {
            if (subcommand === 'restart') {
                await interaction.reply('Pulling latest git repository and restarting application...');
                exec('git pull && (pm2 restart all || kill 1)', (error, stdout, stderr) => {
                    try {
                        const timestamp = new Date().toISOString();
                        const logEntry = `\n[${timestamp}] RESTART\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\nERROR: ${error ? error.message : 'None'}\n${'='.repeat(50)}\n`;
                        fs.appendFileSync(logFile, logEntry);

                        if (error && !stdout.includes('Already up to date')) {
                            interaction.channel.send(`Error executing restart:\n\`\`\`bash\n${error.message}\n\`\`\``).catch(e => console.error('Failed to send error message:', e));
                            return;
                        }
                        const output = stdout ? stdout : stderr;
                        interaction.channel.send(`Restart successful:\n\`\`\`bash\n${output.slice(0, 1900)}\n\`\`\``).catch(e => console.error('Failed to send success message:', e));
                    } catch (e) {
                        console.error('Error in restart callback:', e);
                    }
                });
            } else if (subcommand === 'stash') {
                await interaction.reply('Stashing current git changes...');
                exec('git stash', (error, stdout, stderr) => {
                    try {
                        const timestamp = new Date().toISOString();
                        const logEntry = `\n[${timestamp}] STASH\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\nERROR: ${error ? error.message : 'None'}\n${'='.repeat(50)}\n`;
                        fs.appendFileSync(logFile, logEntry);

                        if (error) {
                            interaction.channel.send(`Error executing stash:\n\`\`\`bash\n${error.message}\n\`\`\``).catch(e => console.error('Failed to send error message:', e));
                            return;
                        }
                        const output = stdout ? stdout : stderr;
                        interaction.channel.send(`Stash successful:\n\`\`\`bash\n${output.slice(0, 1900)}\n\`\`\``).catch(e => console.error('Failed to send success message:', e));
                    } catch (e) {
                        console.error('Error in stash callback:', e);
                    }
                });
            } else if (subcommand === 'v') {
                exec('git --version && git log -1 --oneline', (error, stdout, stderr) => {
                    try {
                        if (error) {
                            interaction.reply({ content: `Error executing git version:\n\`\`\`bash\n${error.message}\n\`\`\``, flags: 64 }).catch(e => console.error('Failed to reply:', e));
                            return;
                        }
                        const output = stdout ? stdout : stderr;
                        interaction.reply({ content: `Git Version & Last Commit:\n\`\`\`bash\n${output}\n\`\`\``, flags: 64 }).catch(e => console.error('Failed to reply:', e));
                    } catch (e) {
                        console.error('Error in git v callback:', e);
                    }
                });
            }
        } catch (e) {
            console.error('Error in git command:', e);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while executing the git command.', flags: 64 });
                }
            } catch (replyError) {
                console.error('Failed to send error reply:', replyError);
            }
        }
    },
};
