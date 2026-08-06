-- Convocatoria: which players (from the full roster) are called up for a
-- given match. Null means "no convocatoria set" — the tracker falls back to
-- showing the full roster, so existing matches keep working unchanged.
alter table matches add column if not exists called_up_players jsonb;
