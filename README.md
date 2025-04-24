# Metalifebot
A discord bot with some custom features

## Requirements
- Mariadb
- Nodejs

## Features
- Testing connection to Discord API when launching the bot.
- Localization system (French and English available by default, but you can add as many as needed)
- Creates a voice channel and updates its name to display members count.
- Gives a configured role to each member that reaches the invites threshold.
- Removes the configured role if invited user leaves the guild and threshold is not reached anymore.
- Sends a private message when role is given or removed (with localization).
- /website : shares metalife website in the chat.
- /invites : retreive invites count for the user.

## How to use ?
- Create a file named /db.js
```js
const mariadb = require('mariadb');

const pool = mariadb.createPool({
	host: 'localhost',
	user: 'root',
	password: 'password',
	database: 'db_name',
	connectionLimit: 5,
	port: '3306',
});

module.exports = pool;

```
- Create a file named /config.json
```json
{
	"token": "discord_token_here",
	"clientId": "discord_client_id_here",
	"guildId": "discord_server_id_here", // leave it empty to deploy commands in all the guilds
	"lang": "fr",
	"DEBUG_MODE": false,
	"INVITE_THRESHOLD": 10,
	"INVITER_ROLE_NAME": "📀・VIP", // don't need this if you already have a roleToGiveId (for single guild)
	"roleToGiveId": "role_id", // if you use the bot for aa single guild, put the role id here
	"DEBOUNCE_TIME": 300000 // Minimum time before updating member counts to prevent spam (5 minutes by default)
}
```

- Execute the sql commands from the file `db.sql` in your mariadb.

- Deploy the commands using: `node deploy-commands.js`

- Launch the bot using: `node index.js`