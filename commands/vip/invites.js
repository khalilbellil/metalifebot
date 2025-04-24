const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const pool = require('../../db');
const { getLocale } = require('../../global');
const { DEBUG_MODE } = require('../../config.json');

module.exports = {
  category: 'vip',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Retreive my invites count.'),
  async execute(interaction) {
    let conn;
    try {
      conn = await pool.getConnection();
      // Retrieve the inviter's new invites count
      const resultCount = await conn.query(
        'SELECT invite_count FROM invite_counts WHERE inviter_id = ? AND guild_id = ?',
        [interaction.user.id, interaction.guildId],
      );
      if (resultCount.length > 0) {
        await interaction.reply({ content: getLocale('display_count', [resultCount[0].invite_count]), flags: MessageFlags.Ephemeral });
        if (DEBUG_MODE) console.log(`User ${interaction.user.id} has ${resultCount[0].invite_count} invites.`);
      }
      else {
        await interaction.reply({ content: getLocale('count_not_found'), flags: MessageFlags.Ephemeral });
        if (DEBUG_MODE) console.log(`User ${interaction.user.id} not found in table invite_count.`);
      }
    }
    catch (err) {
      console.error('Database error:', err);
    }
    finally {
      if (conn) conn.release();
    }
  },
};