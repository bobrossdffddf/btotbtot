async function upsertAnnouncementMessage({
    client,
    guildId,
    channel,
    content = '',
    embeds = [],
    components = [],
    announcementMessageId,
}) {
    const settings = client.settings.get(guildId) || {};
    const storedAnnouncementMessageId = announcementMessageId || settings.announcementMessageId;
    let announcementMessage = null;

    if (storedAnnouncementMessageId) {
        try {
            announcementMessage = await channel.messages.fetch(storedAnnouncementMessageId);
        } catch (error) {
            announcementMessage = null;
        }
    }

    if (announcementMessage) {
        return announcementMessage.edit({ content, embeds, components });
    }

    const sentMessage = await channel.send({ content, embeds, components });
    client.settings.set(guildId, { ...settings, announcementMessageId: sentMessage.id });
    return sentMessage;
}

module.exports = {
    upsertAnnouncementMessage,
};
