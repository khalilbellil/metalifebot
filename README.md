# Metalifebot
A discord bot with some custom features

## Features
- Add a role called '📀・VIP' to each member that invites 10 users to the discord server.
- /website : shares metalife website in the chat

## How to use ?
- Create a file named /db.js
```js
const mariadb = require('mariadb');

const pool = mariadb.createPool({
	host: 'localhost',
	user: 'root',
	password: 'password',
	database: 'metalifebot',
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
	"roleToGiveId": "role_id" // if you use the bot for aa single guild, put the role id here
}
```
