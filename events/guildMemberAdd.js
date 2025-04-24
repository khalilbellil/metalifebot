const { Events, Collection } = require('discord.js');
const pool = require('../db');
const { getLocale, updateMemberCount } = require('../global');
const { INVITE_THRESHOLD, INVITER_ROLE_NAME, roleToGiveId, DEBUG_MODE } = require('../config.json');

/**
 * Update and retrieve the invite count for a specific inviter in a guild.
 * @param {string} inviterId - The Discord ID of the inviter.
 * @param {string} guildId - The Discord ID of the guild.
 * @param {string} inviteeId - The Discord ID of the invitee.
 * @returns {Promise<number|null>} - The new invite count, or null if an error occurred.
 */
async function updateInviteCount(inviterId, guildId, inviteeId) {
  let conn;
  try {
    conn = await pool.getConnection();
    // Check if the invitee has already been invited in this guild
    const existingInvite = await conn.query(
      'SELECT 1 FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?',
      [guildId, inviteeId],
    );

    if (existingInvite.length === 0) {
      // Record the new invitation
      await conn.query(
        'INSERT INTO invite_tracking (inviter_id, guild_id, invitee_id) VALUES (?, ?, ?)',
        [inviterId, guildId, inviteeId],
      );

      // Check if the inviter already has a record in this guild
      const inviterRecord = await conn.query(
        'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
        [inviterId, guildId],
      );

      if (inviterRecord.length === 0) {
        // Insert a new record for this inviter in the guild
        await conn.query(
          'INSERT INTO invite_counts (inviter_id, guild_id, invite_count) VALUES (?, ?, ?)',
          [inviterId, guildId, 1],
        );
        return 1;
      }
      else {
        // Update the invite count for this inviter in the guild
        await conn.query(
          'UPDATE invite_counts SET invite_count = invite_count + 1 WHERE inviter_id = ? AND guild_id = ?',
          [inviterId, guildId],
        );
        // Retrieve the updated count
        const updatedRecord = await conn.query(
          'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
          [inviterId, guildId],
        );
        return updatedRecord[0].invite_count;
      }
    }
    else {
      // The invitee has already been counted; do not increment the invite count
      if (DEBUG_MODE) console.log(`Invitee ${inviteeId} has already been invited by ${inviterId} in guild ${guildId}.`);
      return null;
    }
  }
  catch (err) {
    console.error('Database error:', err);
    return null;
  }
  finally {
    if (conn) conn.release();
  }
}


module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    if (DEBUG_MODE) console.log('EVENT: GuildMemberAdd');
    const guild = member.guild;
    await updateMemberCount(guild);
    let roleToGive = guild.roles.cache.find(r => r.name === INVITER_ROLE_NAME);
    if (!roleToGive) {
      if (DEBUG_MODE) console.log('Role not found using role name, now trying with role id...');
      roleToGive = guild.roles.cache.get(roleToGiveId);
      if (!roleToGive) {
        if (DEBUG_MODE) console.log('Role not found using role id !');
        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Fetch new invites (without force:true)
      const newInvites = await guild.invites.fetch();
      const oldInvites = guild.client.oldInvites.get(guild.id);

      // Debug logs: print old and new invite usage for each invite code
      if (DEBUG_MODE) console.log('--- Old Invites ---');
      if (oldInvites) {
        if (DEBUG_MODE) {
          oldInvites.forEach((invite, code) => {
            console.log(`Code: ${code}, uses: ${invite.uses}`);
          });
        }
      }
      else if (DEBUG_MODE) {console.log('No old invites found.');}

      if (DEBUG_MODE) console.log('--- New Invites ---');
      if (DEBUG_MODE) {
        newInvites.forEach(invite => {
          console.log(`Code: ${invite.code}, uses: ${invite.uses}`);
        });
      }

      if (!oldInvites) {
        member.guild.client.oldInvites.set(member.guild.id, newInvites);
        if (DEBUG_MODE) console.log(`No cached invites for guild ${member.guild.id}. Cache initialized.`);
        return;
      }

      // Determine which invite's usage increased
      const usedInvite = newInvites.find(inv => {
        const oldInvite = oldInvites.get(inv.code);
        if (!oldInvite) {
          if (DEBUG_MODE) console.log(`No old invite data for code ${inv.code}`);
          return false;
        }
        return oldInvite.uses < inv.uses;
      });

      if (!usedInvite) {
        if (DEBUG_MODE) console.log('No used invite detected. It may be a vanity URL or the usage hasn\'t updated yet.');
        return;
      }

      // Update the cache with the latest invites
      const newSnapshots = new Collection();
      newInvites.forEach(invite => {
        newSnapshots.set(invite.code, {
          code: invite.code,
          uses: invite.uses,
          inviterId: invite.inviter?.id,
        });
      });
      guild.client.oldInvites.set(guild.id, newSnapshots);

      const inviter = usedInvite.inviter;
      if (DEBUG_MODE) console.log(`Invite used by ${member.user.tag} via code ${usedInvite.code} (created by ${inviter.tag})`);

      const newCount = await updateInviteCount(inviter.id, member.guild.id, member.user.id);
      if (newCount === null) return;

      if (DEBUG_MODE) console.log(`${inviter.tag} now has ${newCount} invites in guild ${member.guild.id}.`);

      if (newCount >= INVITE_THRESHOLD) {
        const role = roleToGive;
        if (role) {
          const inviterMember = await member.guild.members.fetch(inviter.id);
          if (inviterMember) {
            inviterMember.roles.add(role)
              .then(() => {
                inviterMember.send(getLocale('congrats_vip', [
                  INVITE_THRESHOLD,
                  member.guild.name,
                  role.name,
								  ]));
                if (DEBUG_MODE) console.log(`Assigned ${role.name} role to ${inviter.tag}`);
              })
              .catch(console.error);
          }
        }
        else if (DEBUG_MODE) {console.log(`Role ${INVITER_ROLE_NAME} not found in ${member.guild.name}`);}
      }
    }
    catch (error) {
      console.error('Error processing invite:', error);
      return;
    }
  },
};