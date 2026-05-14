-- Optional realtime publication setup
-- Run in Supabase SQL editor

alter publication supabase_realtime add table public.cats;

-- Presence channel used by app:
-- channel name: pawland-room-main
-- No SQL table is required for Presence state.
