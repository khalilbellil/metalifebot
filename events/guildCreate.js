const { Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { clientId, token, DEBUG_MODE } = require('../config.json');
const { updateMemberCount } = require('../global');

// Load all commands
const commands = [];
const foldersPath = path.join(__dirname, '..', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST().setToken(token);

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    try {
      if (DEBUG_MODE) console.log(`Bot joined new guild: ${guild.name} (${guild.id})`);

      // Deploy commands to the new guild
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guild.id),
        { body: commands },
      );

      if (DEBUG_MODE) console.log(`Successfully deployed ${data.length} commands to ${guild.name}`);

      await updateMemberCount(guild);
    }
    catch (error) {
      console.error(`Error deploying commands to ${guild.name}:`, error);
    }
  },
};