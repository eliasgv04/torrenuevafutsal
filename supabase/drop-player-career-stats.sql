-- player_career_stats (manual "Partidos"/"Goles" totals) is no longer used:
-- the Plantilla player popup now shows real match_player_stats history
-- (totals + last 3 matches) instead of hand-entered career numbers.
drop table if exists player_career_stats;
