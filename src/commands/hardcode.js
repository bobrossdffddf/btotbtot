const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

const PAGE_SIZE = 15;
const COMPONENT_PREFIX = 'hc';

const getBypasses = (client, guildId) => client.settings.get(guildId, 'hardcodeBypasses') || [];

const setBypasses = (client, guildId, bypasses) => {
    client.settings.set(guildId, bypasses, 'hardcodeBypasses');
};

const buildListEmbed = (guild, bypasses, page = 0) => {
    const totalPages = Math.max(1, Math.ceil(bypasses.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * PAGE_SIZE;
    const current = bypasses.slice(start, start + PAGE_SIZE);

    const description = current.length
        ? current.map((identifier, index) => `\`${start + index + 1}.\` ${identifier}`).join('\n')
        : 'No hardcoded bypass users set.';

    const embed = new EmbedBuilder()
        .setTitle('Hardcode Bypass List')
        .setColor('#5865F2')
        .setDescription(description)
        .setFooter({ text: `Page ${safePage + 1}/${totalPages} • ${bypasses.length} total` });

    return { embed, safePage, totalPages, current };
};

const buildListComponents = (bypasses, page = 0, actorId = '0') => {
    const { safePage, totalPages, current } = buildListEmbed(null, bypasses, page);

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${COMPONENT_PREFIX}:prev:${actorId}:${safePage}`)
            .setLabel('Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`${COMPONENT_PREFIX}:next:${actorId}:${safePage}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`${COMPONENT_PREFIX}:refresh:${actorId}:${safePage}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary),
    );

    const removeSelect = new StringSelectMenuBuilder()
        .setCustomId(`${COMPONENT_PREFIX}:remove_select:${actorId}:${safePage}`)
        .setPlaceholder(current.length ? 'Quick remove an identifier' : 'No identifiers available')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(!current.length)
        .addOptions(
            current.length
                ? current.map(identifier => ({
                    label: identifier.slice(0, 100),
                    value: identifier,
                    description: 'Remove this bypass',
                }))
                : [{ label: 'No entries', value: '__none__', description: 'No bypasses found' }],
        );

    const editSelect = new StringSelectMenuBuilder()
        .setCustomId(`${COMPONENT_PREFIX}:edit_select:${actorId}:${safePage}`)
        .setPlaceholder(current.length ? 'Quick edit an identifier' : 'No identifiers available')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(!current.length)
        .addOptions(
            current.length
                ? current.map(identifier => ({
                    label: identifier.slice(0, 100),
                    value: identifier,
                    description: 'Edit this bypass',
                }))
                : [{ label: 'No entries', value: '__none__', description: 'No bypasses found' }],
        );

    return [
        navRow,
        new ActionRowBuilder().addComponents(removeSelect),
        new ActionRowBuilder().addComponents(editSelect),
    ];
};

const buildListView = (guild, bypasses, page = 0, actorId = '0') => {
    const { embed, safePage } = buildListEmbed(guild, bypasses, page);
    const components = buildListComponents(bypasses, safePage, actorId);

    return { embed, components, page: safePage };
};

module.exports = {
    PAGE_SIZE,
    COMPONENT_PREFIX,
    getBypasses,
    setBypasses,
    buildListView,
    data: new SlashCommandBuilder()
        .setName('hardcode')
        .setDescription('Manage hardcode bypass users')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a bypass identifier')
                .addStringOption(option =>
                    option.setName('identifier')
                        .setDescription('Roblox username or ID')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a bypass identifier')
                .addStringOption(option =>
                    option.setName('identifier')
                        .setDescription('Roblox username or ID')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List current bypass identifiers with quick actions'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing bypass identifier')
                .addStringOption(option =>
                    option.setName('old_identifier')
                        .setDescription('Existing identifier')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option.setName('new_identifier')
                        .setDescription('Replacement identifier')
                        .setRequired(true),
                ),
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const bypasses = getBypasses(client, guildId);

        if (subcommand === 'add') {
            const identifier = interaction.options.getString('identifier').trim();

            if (bypasses.includes(identifier)) {
                return interaction.reply({ content: `\`${identifier}\` is already in the bypass list.`, flags: 64 });
            }

            bypasses.push(identifier);
            setBypasses(client, guildId, bypasses);
            return interaction.reply({ content: `Successfully added \`${identifier}\` to the hardcode bypass list.`, flags: 64 });
        }

        if (subcommand === 'remove') {
            const identifier = interaction.options.getString('identifier').trim();
            const next = bypasses.filter(entry => entry !== identifier);

            if (next.length === bypasses.length) {
                return interaction.reply({ content: `\`${identifier}\` was not found in the bypass list.`, flags: 64 });
            }

            setBypasses(client, guildId, next);
            return interaction.reply({ content: `Removed \`${identifier}\` from the hardcode bypass list.`, flags: 64 });
        }

        if (subcommand === 'edit') {
            const oldIdentifier = interaction.options.getString('old_identifier').trim();
            const newIdentifier = interaction.options.getString('new_identifier').trim();
            const oldIndex = bypasses.indexOf(oldIdentifier);

            if (oldIndex === -1) {
                return interaction.reply({ content: `\`${oldIdentifier}\` was not found in the bypass list.`, flags: 64 });
            }

            if (bypasses.includes(newIdentifier)) {
                return interaction.reply({ content: `\`${newIdentifier}\` is already in the bypass list.`, flags: 64 });
            }

            bypasses[oldIndex] = newIdentifier;
            setBypasses(client, guildId, bypasses);
            return interaction.reply({ content: `Updated \`${oldIdentifier}\` to \`${newIdentifier}\`.`, flags: 64 });
        }

        const view = buildListView(interaction.guild, bypasses, 0, interaction.user.id);
        return interaction.reply({ embeds: [view.embed], components: view.components, flags: 64 });
    },
};
