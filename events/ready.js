const { Events, Collection } = require('discord.js');

const DEBUG_MODE = false;

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		// Initialize oldInvites as a Collection
		client.oldInvites = new Collection();

		// Pre-populate invites for all guilds in parallel
		await Promise.all(client.guilds.cache.map(async guild => {
			try {
				const guildInvites = await guild.invites.fetch();
				const inviteSnapshots = new Collection();
				guildInvites.forEach(invite => {
					// Store plain object snapshots instead of live Invite instances
					inviteSnapshots.set(invite.code, {
						code: invite.code,
						uses: invite.uses,
						inviterId: invite.inviter?.id,
					});
				});
				client.oldInvites.set(guild.id, inviteSnapshots);

				if (DEBUG_MODE) {
					console.log(`--- Init Invites for ${guild.name} ---`);
					inviteSnapshots.forEach((invite, code) => {
						console.log(`Code: ${code}, uses: ${invite.uses}`);
					});
				}

			}
			catch (error) {
				console.error(`Error fetching invites for ${guild.name}:`, error);
			}
		}));
		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};