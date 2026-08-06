-- api.js does .upsert(..., {onConflict:'match_id,player_id'}) on match_player_stats
-- and .upsert(..., {onConflict:'match_id'}) on rival_team_stats, but neither table
-- had a matching unique constraint. Postgres requires one for ON CONFLICT to work,
-- so every upsert was silently failing and falling back to localStorage-only saves
-- (confirmed: both tables had 0 rows despite a finished match already existing).
alter table match_player_stats
  add constraint match_player_stats_match_player_unique unique (match_id, player_id);

alter table rival_team_stats
  add constraint rival_team_stats_match_unique unique (match_id);
