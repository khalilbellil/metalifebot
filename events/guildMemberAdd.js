const { Events, Collection } = require('discord.js');
const pool = require('../db');
const { getLocale, updateMemberCount } = require('../global');
const { INVITE_THRESHOLD, INVITER_ROLE_NAME, roleToGiveId, DEBUG_MODE } = require('../config.json');

/**
 * Get the role to give to the inviter
 * @param {import('discord.js').Guild} guild - The guild to get the role from
 * @returns {Promise<import('discord.js').Role|null>} - The role to give or null if not found
 */
async function getRoleToGive(guild) {
  let roleToGive = guild.roles.cache.find(r => r.name === INVITER_ROLE_NAME);
  if (!roleToGive) {
    if (DEBUG_MODE) console.log('Role not found using role name, now trying with role id...');
    roleToGive = guild.roles.cache.get(roleToGiveId);
    if (!roleToGive) {
      if (DEBUG_MODE) console.log('Role not found using role id !');
      return null;
    }
  }
  return roleToGive;
}

/**
 * Give the role to the inviter and notify them
 * @param {import('discord.js').GuildMember} inviterMember - The inviter's guild member object
 * @param {import('discord.js').Role} role - The role to give
 * @param {import('discord.js').Guild} guild - The guild where the role is being given
 */
async function giveRoleAndNotify(inviterMember, role, guild) {
  try {
    await inviterMember.roles.add(role);
    await inviterMember.send(getLocale('congrats_vip', [
      INVITE_THRESHOLD,
      guild.name,
      role.name,
    ]));
    if (DEBUG_MODE) console.log(`Assigned ${role.name} role to ${inviterMember.user.tag}`);
  }
  catch (error) {
    console.error(`Error assigning role to ${inviterMember.user.tag}:`, error);
  }
}

/**
 * Update the invite tracking in the database
 * @param {import('discord.js').Guild} guild - The guild where the invite was used
 * @param {import('discord.js').User} inviter - The user who created the invite
 * @param {import('discord.js').GuildMember} member - The member who joined
 * @param {import('mysql2/promise').Pool} _pool - The database connection pool
 * @returns {Promise<number>} - The new invite count
 */
async function updateInviteTracking(guild, inviter, member, _pool) {
  let conn;
  let newCount = 0;
  try {
    conn = await _pool.getConnection();
    const existingInvite = await conn.query(
      'SELECT 1 FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?',
      [guild.id, member.id],
    );

    if (existingInvite.length === 0) {
      // Record the new invitation
      await conn.query(
        'INSERT INTO invite_tracking (inviter_id, guild_id, invitee_id) VALUES (?, ?, ?)',
        [inviter.id, guild.id, member.id],
      );

      // Check if the inviter already has a record in this guild
      const inviterRecord = await conn.query(
        'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
        [inviter.id, guild.id],
      );

      if (inviterRecord.length === 0) {
        // Insert a new record for this inviter in the guild
        await conn.query(
          'INSERT INTO invite_counts (inviter_id, guild_id, invite_count) VALUES (?, ?, ?)',
          [inviter.id, guild.id, 1],
        );
        newCount = 1;
        if (DEBUG_MODE) console.log(`Created new invite count record for ${inviter.tag}: 1 invite`);
      }
      else {
        // Update the invite count for this inviter in the guild
        await conn.query(
          'UPDATE invite_counts SET invite_count = invite_count + 1 WHERE inviter_id = ? AND guild_id = ?',
          [inviter.id, guild.id],
        );
        // Retrieve the updated count
        const updatedRecord = await conn.query(
          'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
          [inviter.id, guild.id],
        );
        newCount = updatedRecord[0].invite_count;
        if (DEBUG_MODE) console.log(`Updated invite count for ${inviter.tag}: ${newCount} invites`);
      }
    }
    else if (DEBUG_MODE) {console.log(`Invite for ${member.user.tag} already tracked`);}
  }
  catch (err) {
    console.error('Database error:', err);
  }
  finally {
    if (conn) await conn.release();
  }
  return newCount;
}

/**
 * Find the invite that was used to join
 * @param {import('discord.js').Collection} newInvites - The current invites
 * @param {import('discord.js').Collection} oldInvites - The previous invites
 * @returns {Promise<import('discord.js').Invite|null>} - The used invite or null if not found
 */
async function findUsedInvite(newInvites, oldInvites) {
  // First check for invites with increased usage
  let usedInvite = newInvites.find(inv => {
    const oldInvite = oldInvites.get(inv.code);
    if (!oldInvite) {
      if (DEBUG_MODE) console.log(`No old invite data for code ${inv.code}`);
      return false;
    }
    return oldInvite.uses < inv.uses;
  });

  if (!usedInvite) {
    // If no invite with increased usage is found, check for new invites
    const newInvite = newInvites.find(inv => !oldInvites.has(inv.code));
    if (newInvite) {
      if (DEBUG_MODE) console.log(`New invite detected: ${newInvite.code}`);
      usedInvite = newInvite;
    }
    else if (DEBUG_MODE) {console.log('No used invite detected. It may be a vanity URL or the usage hasn\'t updated yet.');}
  }

  return usedInvite;
}

/**
 * Handle the addition of a member to the guild
 * @param {import('discord.js').GuildMember} member - The member who joined
 * @param {import('mysql2/promise').Pool} _pool - The database connection pool
 */
async function handleMemberAddition(member, _pool) {
  if (DEBUG_MODE) console.log('EVENT: GuildMemberAdd');
  const guild = member.guild;
  await updateMemberCount(guild);

  const roleToGive = await getRoleToGive(guild);
  if (!roleToGive) return;

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Fetch new invites (without force:true)
    const newInvites = await guild.invites.fetch();
    const oldInvites = guild.client.oldInvites.get(guild.id);

    if (!oldInvites) {
      guild.client.oldInvites.set(guild.id, newInvites);
      if (DEBUG_MODE) console.log(`No cached invites for guild ${guild.id}. Cache initialized.`);
      return;
    }

    // Debug logs: print old and new invite usage for each invite code
    if (DEBUG_MODE) {
      console.log('--- Old Invites ---');
      oldInvites.forEach((invite, code) => {
        console.log(`Code: ${code}, uses: ${invite.uses}`);
      });
      console.log('--- New Invites ---');
      newInvites.forEach(invite => {
        console.log(`Code: ${invite.code}, uses: ${invite.uses}`);
      });
    }

    const usedInvite = await findUsedInvite(newInvites, oldInvites);
    if (!usedInvite) return;

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
    if (!inviter) {
      if (DEBUG_MODE) console.log('No inviter found for the used invite');
      return;
    }

    if (DEBUG_MODE) console.log(`Invite used by ${member.user.tag} via code ${usedInvite.code} (created by ${inviter.tag})`);

    const newCount = await updateInviteTracking(guild, inviter, member, _pool);
    if (newCount === 0) return;

    if (DEBUG_MODE) console.log(`${inviter.tag} now has ${newCount} invites in guild ${guild.name}.`);

    if (newCount >= INVITE_THRESHOLD) {
      const inviterMember = await guild.members.fetch(inviter.id);
      if (inviterMember) {
        await giveRoleAndNotify(inviterMember, roleToGive, guild);
      }
    }
  }
  catch (error) {
    console.error('Error processing invite:', error);
  }
}

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    await handleMemberAddition(member, pool);
  },
};