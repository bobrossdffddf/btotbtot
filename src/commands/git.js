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
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'You do not have permission to use this command. This is restricted to the specific owner ID.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const logFile = path.join(process.cwd(), 'git_commands.log');

        if (subcommand === 'restart') {
            await interaction.reply('Pulling latest git repository and restarting application...');
            // Since we are on Replit, we use git pull and then restart the workflow or process. 
            // The user specifically mentioned PM2, but Replit doesn't usually use PM2.
            // However, I will keep the command structure but ensure it works.
            exec('git pull && (pm2 restart all || kill 1)', (error, stdout, stderr) => {
                const timestamp = new Date().toISOString();
                const logEntry = `\n[${timestamp}] RESTART\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\nERROR: ${error ? error.message : 'None'}\n${'='.repeat(50)}\n`;
                fs.appendFileSync(logFile, logEntry);

                if (error && !stdout.includes('Already up to date')) {
                    return interaction.channel.send(`Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``);
                }
                const output = stdout ? stdout : stderr;
                interaction.channel.send(`Command Output:\n\`\`\`bash\n${output.slice(0, 1900)}\n\`\`\``);
            });
        }

        if (subcommand === 'stash') {
            await interaction.reply('Stashing current git changes...');
            exec('git stash', (error, stdout, stderr) => {
                const timestamp = new Date().toISOString();
                const logEntry = `\n[${timestamp}] STASH\nSTDOUT: ${stdout}\nSTDERR: ${stderr}\nERROR: ${error ? error.message : 'None'}\n${'='.repeat(50)}\n`;
                fs.appendFileSync(logFile, logEntry);

                if (error) {
                    return interaction.channel.send(`Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``);
                }
                const output = stdout ? stdout : stderr;
                interaction.channel.send(`Command Output:\n\`\`\`bash\n${output.slice(0, 1900)}\n\`\`\``);
            });
        }

        if (subcommand === 'v') {
            exec('git --version && git log -1 --oneline', (error, stdout, stderr) => {
                if (error) {
                    return interaction.reply({ content: `Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``, flags: 64 });
                }
                const output = stdout ? stdout : stderr;
                interaction.reply({ content: `Git Version & Last Commit:\n\`\`\`bash\n${output}\n\`\`\``, flags: 64 });
            });
        }
    },
};
