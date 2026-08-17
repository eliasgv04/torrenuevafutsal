-- GDPR / RGPD support: recorded consent on the public access-request form.
-- Run this once against an existing database; schema.sql already includes
-- this column for fresh installs.

-- Access requests: the public "solicitar acceso" form collects personal
-- data (name, email) before any account exists, so consent must be recorded
-- at that point.
alter table access_requests add column if not exists privacy_accepted boolean not null default false;
