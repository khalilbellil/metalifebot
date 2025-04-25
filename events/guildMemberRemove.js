const { Events } = require('discord.js');
const pool = require('../db');
const { getLocale, updateMemberCount } = require('../global');
const { INVITE_THRESHOLD, INVITER_ROLE_NAME, DEBUG_MODE, roleToGiveId } = require('../config.json');

/**
 * Get the role to remove from the inviter
 * @param {import('discord.js').Guild} guild - The guild to get the role from
 * @returns {Promise<import('discord.js').Role|null>} - The role to remove or null if not found
 */
async function getRoleToRemove(guild) {
  let roleToRemove = guild.roles.cache.find(r => r.name === INVITER_ROLE_NAME);
  if (!roleToRemove) {
    if (DEBUG_MODE) console.log('Role not found using role name, now trying with role id...');
    roleToRemove = guild.roles.cache.get(roleToGiveId);
    if (!roleToRemove) {
      if (DEBUG_MODE) console.log('Role not found using role id !');
      return null;
    }
  }
  return roleToRemove;
}

/**
 * Remove the role from the inviter and notify them
 * @param {import('discord.js').GuildMember} inviterMember - The inviter's guild member object
 * @param {import('discord.js').Role} role - The role to remove
 * @param {import('discord.js').Guild} guild - The guild where the role is being removed
 */
async function removeRoleAndNotify(inviterMember, role, guild) {
  try {
    await inviterMember.roles.remove(role);
    await inviterMember.send(getLocale('remove_vip', [
      guild.name,
      role.name,
    ]));
    if (DEBUG_MODE) console.log(`Removed ${role.name} role from ${inviterMember.user.tag}`);
  }
  catch (error) {
    console.error(`Error removing role from ${inviterMember.user.tag}:`, error);
  }
}

/**
 * Handle the removal of a member from the guild
 * @param {import('discord.js').GuildMember} member - The member who left
 * @param {import('mysql2/promise').Pool} _pool - The database connection pool
 */
async function handleMemberRemoval(member, _pool) {
  let conn;
  try {
    conn = await _pool.getConnection();
    const guild = member.guild;
    await updateMemberCount(guild);

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

      // Remove the invite tracking record
      await conn.query(
        'DELETE FROM invite_tracking WHERE invitee_id = ? AND guild_id = ?',
        [member.id, guild.id],
      );

      if (DEBUG_MODE) console.log(`Decremented invite count for inviter ${inviterId} due to ${member.id} leaving.`);

      // Retrieve the inviter's new invites count
      const resultCount = await conn.query(
        'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
        [inviterId, guild.id],
      );

      if (resultCount.length > 0) {
        const newCount = resultCount[0].invite_count;

        // Remove role if invite threshold is not reached anymore
        if (newCount === (INVITE_THRESHOLD - 1)) {
          const roleToRemove = await getRoleToRemove(guild);
          if (roleToRemove) {
            const inviterMember = await member.guild.members.fetch(inviterId);
            if (inviterMember) {
              await removeRoleAndNotify(inviterMember, roleToRemove, guild);
            }
          }
        }
      }
      else if (DEBUG_MODE) {
        console.log(`invite_count not found for member ${inviterId} in guild ${member.guild.id}`);
      }
    }
    else if (DEBUG_MODE) {
      console.log(`No inviter found for member ${member.id} in guild ${member.guild.id}.`);
    }
  }
  catch (err) {
    console.error('Database error:', err);
  }
  finally {
    if (conn) await conn.release();
  }
}

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    await handleMemberRemoval(member, pool);
  },
};