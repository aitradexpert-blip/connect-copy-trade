-- lovable-cron-fallback-reviewed: MT5 terminals expose no close webhook; polling the Master account is the only way to detect manual/SL/TP closes.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'master-position-sync-every-minute';
SELECT cron.schedule(
  'master-position-sync-every-minute',
  '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://tkgguyjoynnrsayfxzvj.supabase.co/functions/v1/master-position-sync',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrZ2d1eWpveW5ucnNheWZ4enZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMzI4OTUsImV4cCI6MjA3MjYwODg5NX0.FyyQWj3QD9ycJlk0n3snphKTjajV9uPbI6vtZeO59g8"}'::jsonb,
    body := '{"mode":"cron","passes":3}'::jsonb,
    timeout_milliseconds := 60000
  ); $$
);