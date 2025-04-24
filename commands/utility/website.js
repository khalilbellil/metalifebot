const { SlashCommandBuilder } = require('discord.js');
const { getLocale } = require('../../global');

module.exports = {
  category: 'utility',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('website')
    .setDescription('Replies with our Website link'),
  async execute(interaction) {
    await interaction.reply(getLocale('website_link'));
  },
};