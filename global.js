/* eslint-disable no-inline-comments */
const { lang, DEBOUNCE_TIME } = require('./config.json');
const locales = require(`./locales/${lang}.json`);

module.exports = {
  lang: lang,
  getLocale(key, variables = []) {
    const template = locales[key] || `[TRANSLATION MISSING: ${key}]`;
    return template.replace(/\$(\d+)/g, (_, index) => {
      const idx = parseInt(index) - 1;
      return variables[idx] !== undefined ? variables[idx] : `[MISSING VAR ${index}]`;
    });
  },
  updateCooldown: new Set(),
  /**
	 * Update the member count channel for a guild.
	 * @param {import('discord.js').Guild} guild - The guild to update the member count for.
	 */
  async updateMemberCount(guild) {
    if (module.exports.updateCooldown.has(guild.id)) return;
    module.exports.updateCooldown.add(guild.id);

    try {
	  const channelName = `${module.exports.getLocale('member_count_channel_name')}${guild.memberCount.toLocaleString()}`;
	  const channel = guild.channels.cache.find(ch =>
        ch.name.startsWith(module.exports.getLocale('member_count_channel_name')) && ch.type === 2,
	  );

	  if (channel) {
        if (channel.name !== channelName) {
		  await channel.setName(channelName);
        }
	  }
      else {
        await guild.channels.create({
          name: channelName,
          type: 2, // Voice channel
          position: 0,
          reason: 'Automatic member counter',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: ['Connect'],
              allow: ['ViewChannel'],
            },
          ],
        });
	  }
    }
    catch (error) {
      console.error(`Error updating member count for ${guild.name}:`, error);
    }
    finally {
      setTimeout(() => module.exports.updateCooldown.delete(guild.id), DEBOUNCE_TIME);
    }
  },
};