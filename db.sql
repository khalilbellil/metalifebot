CREATE DATABASE IF NOT EXISTS `metalifebot`;

CREATE TABLE IF NOT EXISTS invite_counts (
  inviter_id VARCHAR(50),
  guild_id VARCHAR(50),
  invite_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (inviter_id, guild_id)
);