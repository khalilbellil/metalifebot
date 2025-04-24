CREATE TABLE IF NOT EXISTS invite_counts (
  inviter_id VARCHAR(255),
  guild_id VARCHAR(255),
  invite_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (inviter_id, guild_id)
);

CREATE TABLE IF NOT EXISTS invite_tracking (
    inviter_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    invitee_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (inviter_id, guild_id, invitee_id)
);
