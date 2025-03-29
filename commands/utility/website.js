const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('website')
		.setDescription('Replies with Metalife Website link'),
	async execute(interaction) {
		await interaction.reply('[Metalife.mp](https://metalife.mp)');
	},
};