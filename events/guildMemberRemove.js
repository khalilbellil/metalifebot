const { Events } = require('discord.js');
const pool = require('../db');
const { getLocale } = require('../global');
const { INVITE_THRESHOLD, INVITER_ROLE_NAME, DEBUG_MODE, roleToGiveId } = require('../config.json');

module.exports = {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member) {
		let conn;
		try {
			conn = await pool.getConnection();
			const guild = member.guild;
			// Retrieve the inviter's ID from the invite_tracking table
			const result = await conn.query(
				'SELECT inviter_id FROM invite_tracking WHERE invitee_id = ? AND guild_id = ?',
				[member.id, member.guild.id],
			);

			if (result.length > 0) {
				const inviterId = result[0].inviter_id;

				// Decrement the invite count for the inviter in the invite_counts table
				await conn.query(
					'UPDATE invite_counts SET invite_count = invite_count - 1 WHERE inviter_id = ? AND guild_id = ? AND invite_count > 0',
					[inviterId, guild.id],
				);

				if (DEBUG_MODE) console.log(`Decremented invite count for inviter ${inviterId} due to ${member.id} leaving.`);

				// Retrieve the inviter's new invites count
				const resultCount = await conn.query(
					'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
					[inviterId, guild.id],
				);
				if (resultCount.length > 0) {
					const newCount = resultCount[0].invite_count;

					// Remove role if invite threshold is not reached anymore and if he had it
					if (newCount === (INVITE_THRESHOLD - 1)) {
						// Retreive role to remove
						let roleToRemove = guild.roles.cache.find(r => r.name === INVITER_ROLE_NAME);
						if (!roleToRemove) {
							if (DEBUG_MODE) console.log('Role not found using role name, now trying with role id...');
							roleToRemove = guild.roles.cache.get(roleToGiveId);
							if (!roleToRemove) {
								if (DEBUG_MODE) console.log('Role not found using role id !');
								return;
							}
						}

						// Retreive inviter member then remove role
						const inviterMember = await member.guild.members.fetch(inviterId);
						if (inviterMember) {
							inviterMember.roles.remove(roleToRemove)
								.then(() => {
									inviterMember.send(getLocale('remove_vip', [
										member.guild.name,
										roleToRemove.name,
									]));
									if (DEBUG_MODE) console.log(`Removed ${roleToRemove.name} role from ${inviterMember.tag}`);
								})
								.catch(console.error);
						}
					}
				}
				else if (DEBUG_MODE) {console.log(`invite_count not found for member ${inviterId} in guild ${member.guild.id}`);}
			}
			else if (DEBUG_MODE) {console.log(`No inviter found for member ${member.id} in guild ${member.guild.id}.`);}
		}
		catch (err) {
			console.error('Database error:', err);
		}
		finally {
			if (conn) conn.release();
		}
	},
};