-- Sends an admin email (via the notify-access-request Edge Function) every
-- time someone submits the public "Solicitar acceso" form. Uses pg_net for
-- a fire-and-forget async HTTP call so the INSERT itself never blocks or
-- fails on email delivery issues.
create extension if not exists pg_net;

create or replace function public.notify_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://wfkjqllicsmqsmthklhz.supabase.co/functions/v1/notify-access-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', 'WVGUHSo853xqttC9wnyLiWCvOWqTlDHqne3Rji1WT5s'
    ),
    body := jsonb_build_object(
      'team_name', new.team_name,
      'contact_name', new.contact_name,
      'contact_email', new.contact_email,
      'message', new.message
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_access_request on access_requests;
create trigger trg_notify_access_request
  after insert on access_requests
  for each row execute function public.notify_access_request();
