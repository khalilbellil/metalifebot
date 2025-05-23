const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const wait = require('node:timers/promises').setTimeout;

module.exports = {
  category: 'utility',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply({ content: 'Pong!', flags: MessageFlags.Ephemeral });
    await wait(2_000);
    await interaction.followUp({ content: 'Pong again!', flags: MessageFlags.Ephemeral });
  },
};