-- GDPR / RGPD support: minors (parental consent) + recorded consent on the
-- public access-request form. Run this once against an existing database;
-- schema.sql already includes these columns for fresh installs.

-- Players: optional birth date lets the app flag minors in the roster, plus
-- a record that guardian consent was obtained (the app can't verify this
-- itself — it trusts the coach's affirmation — but RGPD art. 7.1 requires
-- being able to demonstrate consent was given, so we timestamp it).
alter table players add column if not exists birth_date date;
alter table players add column if not exists guardian_consent boolean not null default false;
alter table players add column if not exists guardian_consent_at timestamp with time zone;

-- Access requests: the public "solicitar acceso" form collects personal
-- data (name, email) before any account exists, so consent must be recorded
-- at that point.
alter table access_requests add column if not exists privacy_accepted boolean not null default false;
