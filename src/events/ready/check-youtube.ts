import Parser from "rss-parser";
import NotificationConfig from "../../models/NotificationConfig";
import { Client } from "discord.js";

const parser = new Parser();

module.exports = (client: Client) => {
    setInterval(checkYoutube, 60000 * 5);
    async function checkYoutube() {
        try {
            const notificationConfigs = await NotificationConfig.find();
            notificationConfigs.map(
                async (notificationConfig) => {
                    const YOUTUBE_RSS_URL = `https://www.youtube.com/feeds/video.xml?channel_id=${notificationConfig.ytChannelId}`;
                    const feed = await parser
                        .parseURL(YOUTUBE_RSS_URL)
                        .catch(() => {});
                    if (!feed?.items.length) {
                        return;
                    }
                    const latestVideo = feed.itemsp[0];
                    const lastCheckedVid = notificationConfig.lastCheckedVid;

                    if (
                        !lastCheckedVid ||
                        (latestVideo.id.split(":")[2] !== lastCheckedVid.id &&
                            new Date(latestVideo.pubDate) >
                                new Date(lastCheckedVid.pubDate))
                    ) {
                        const targetGuild =
                            client.guilds.cache.get(notificationConfig.guildId) ||
                            (await client.guilds.fetch(notificationConfig.guildId));
                        if (!targetGuild) {
                            await NotificationConfig.findOneAndDelete({
                                _id: notificationConfig._id,
                            });
                            return;
                        }
                        const targetChannel =
                            targetGuild.channels.cache.get(
                                notificationConfig.notificationChannelId,
                            ) ||
                            (await targetGuild.channels.fetch(
                                notificationConfig.notificationChannelId,
                            ));
                        if (!targetChannel) {
                            await NotificationConfig.findOneAndDelete({
                                _id: notificationConfig._id,
                            });
                            return;
                        }
                        notificationConfig.lastCheckedVid = {
                            id: latestVideo.id.split(":")[2],
                            pubDate: latestVideo.pubDate,
                        };
                        notificationConfig
                            .save()
                            .then(() => {
                                const targetMessage =
                                    notificationConfig.customMessage
                                        ?.replace("{VIDEO_URL}", latestVideo.link)
                                        ?.replace("{VIDEO_TITLE}", latestVideo.title)
                                        ?.replace("{CHANNEL_URL}", feed.link)
                                        ?.replace("{CHANNEL_NAME}", feed.title) ||
                                    `New upload by ${feed.title}\n${latestVideo.link}`;
                                targetChannel.send(targetMessage);
                            })
                            .catch(() => {});
                    }
                },
            );
        } catch (error) {
            console.log(`Error in ${__filename}:\n`, error);
        }
    }
};
