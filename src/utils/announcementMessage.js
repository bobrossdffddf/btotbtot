async function upsertAnnouncementMessage({
    client,
    guildId,
    channel,
    content = '',
    embeds = [],
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
        return announcementMessage.edit({ content, embeds });
    }

    const sentMessage = await channel.send({ content, embeds });
    client.settings.set(guildId, { ...settings, announcementMessageId: sentMessage.id });
    return sentMessage;
}

module.exports = {
    upsertAnnouncementMessage,
};
