const { Events, Collection } = require('discord.js');
const { updateMemberCount } = require('../global');
const pool = require('../db');
const { DEBUG_MODE } = require('../config.json');

/**
 * Initialize invite tracking for a guild
 * @param {import('discord.js').Guild} guild - The guild to initialize
 * @param {import('discord.js').Client} client - The Discord client
 */
async function initializeGuildInvites(guild, client) {
  if (DEBUG_MODE) console.log(`Initializing guild ${guild.name}...`);

  // Update member count
  await updateMemberCount(guild);

  // Fetch and store current invites
  const guildInvites = await guild.invites.fetch();
  const inviteSnapshots = new Collection();

  guildInvites.forEach(invite => {
    inviteSnapshots.set(invite.code, {
      code: invite.code,
      uses: invite.uses,
      inviterId: invite.inviter?.id,
    });
  });
  client.oldInvites.set(guild.id, inviteSnapshots);

  if (DEBUG_MODE) {
    console.log(`--- Initial Invites for ${guild.name} ---`);
    inviteSnapshots.forEach((invite, code) => {
      console.log(`Code: ${code}, uses: ${invite.uses}, inviter: ${invite.inviterId}`);
    });
  }
}

/**
 * Clean up tracking for members who are no longer in the guild
 * @param {import('discord.js').Guild} guild - The guild to clean up
 * @param {import('mysql2/promise').Pool} _pool - The database connection pool
 */
async function cleanupInvalidTracking(guild, _pool) {
  let conn;
  try {
    conn = await _pool.getConnection();

    // Get all tracked invites for this guild
    const trackedInvites = await conn.query(
      'SELECT invitee_id FROM invite_tracking WHERE guild_id = ?',
      [guild.id],
    );

    // Get all current members
    const currentMembers = await guild.members.fetch();

    // Remove tracking for members who are no longer in the guild
    for (const trackedInvite of trackedInvites) {
      if (!currentMembers.has(trackedInvite.invitee_id)) {
        await conn.query(
          'DELETE FROM invite_tracking WHERE guild_id = ? AND invitee_id = ?',
          [guild.id, trackedInvite.invitee_id],
        );
        if (DEBUG_MODE) console.log(`Removed tracking for non-existent member ${trackedInvite.invitee_id} in ${guild.name}`);
      }
    }
  }
  catch (err) {
    console.error(`Error cleaning up invalid tracking for ${guild.name}:`, err);
  }
  finally {
    if (conn) await conn.release();
  }
}

/**
 * Update invite counts based on current tracking data
 * @param {import('discord.js').Guild} guild - The guild to update
 * @param {import('mysql2/promise').Pool} _pool - The database connection pool
 */
async function updateInviteCounts(guild, _pool) {
  let conn;
  try {
    conn = await _pool.getConnection();

    // Get current invite counts from tracking
    const inviteCounts = await conn.query(
      'SELECT inviter_id, COUNT(*) as count FROM invite_tracking WHERE guild_id = ? GROUP BY inviter_id',
      [guild.id],
    );

    // Update invite counts in the database
    for (const count of inviteCounts) {
      await conn.query(
        'INSERT INTO invite_counts (inviter_id, guild_id, invite_count) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE invite_count = ?',
        [count.inviter_id, guild.id, count.count, count.count],
      );
      if (DEBUG_MODE) console.log(`Updated invite count for ${count.inviter_id} in ${guild.name}: ${count.count}`);
    }
  }
  catch (err) {
    console.error(`Error updating invite counts for ${guild.name}:`, err);
  }
  finally {
    if (conn) await conn.release();
  }
}

/**
 * Initialize a guild with all necessary setup
 * @param {import('discord.js').Guild} guild - The guild to initialize
 * @param {import('discord.js').Client} client - The Discord client
 * @param {import('mysql2/promise').Pool} pool - The database connection pool
 */
async function initializeGuild(guild, client, _pool) {
  try {
    await initializeGuildInvites(guild, client);
    await cleanupInvalidTracking(guild, _pool);
    await updateInviteCounts(guild, _pool);
  }
  catch (error) {
    console.error(`Error initializing ${guild.name}:`, error);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Initialize oldInvites as a Collection
    client.oldInvites = new Collection();

    // Initialize all guilds in parallel
    await Promise.all(client.guilds.cache.map(guild =>
      initializeGuild(guild, client, pool),
    ));

    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};