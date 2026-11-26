-- Schema for the Go Live clone (browser only). Postgres 15+ on Supabase.
-- Access rules: enforced in the FastAPI data layer (one authorisation check per query).
-- RLS is enabled with no public policies, so the browser can never read tables directly.
-- Live media state (who is connected, which tracks exist) lives in LiveKit, not here.
-- This database holds identity, entitlements, rooms, permissions and a stream log.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- plans
create table plans (
  id            text primary key,                      -- 'free', 'hd'
  name          text not null,
  max_height    int  not null check (max_height in (720, 1080, 1440, 2160)),
  max_fps       int  not null check (max_fps in (15, 30, 60)),
  price_cents   int  not null default 0 check (price_cents >= 0),
  currency      text not null default 'cad',
  stripe_price_id text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into plans (id, name, max_height, max_fps, price_cents) values
  ('free', 'Free', 720, 30, 0),
  ('hd',   'HD',  1080, 60, 0);   -- set price + stripe_price_id when billing lands

-- ---------------------------------------------------------------- users
-- id matches auth.users.id from Supabase Auth.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  plan_id       text not null default 'free' references plans(id) on delete restrict,
  stripe_customer_id text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on profiles (plan_id);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles(id) on delete cascade,
  plan_id                text not null references plans(id) on delete restrict,
  stripe_subscription_id text not null unique,
  status                 text not null check (status in
                           ('trialing','active','past_due','canceled','incomplete','unpaid')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on subscriptions (user_id);

-- Stripe retries webhooks; store every event id once.
create table stripe_events (
  id          text primary key,              -- evt_...
  type        text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- rooms
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  max_streams int  not null default 10 check (max_streams between 1 and 50),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on rooms (owner_id);

create table room_members (
  room_id     uuid not null references rooms(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','member')),
  can_stream  boolean not null default true,
  joined_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index on room_members (user_id);

-- ---------------------------------------------------------------- stream log
-- Written by the LiveKit webhook handler, not by the browser.
create table streams (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references rooms(id) on delete cascade,
  streamer_id        uuid not null references profiles(id) on delete cascade,
  livekit_track_sid  text not null unique,
  requested_height   int  not null,
  requested_fps      int  not null,
  published_width    int,
  published_height   int,
  codec              text check (codec in ('vp8','h264','vp9','av1','h265')),
  audio_enabled      boolean not null default false,
  status             text not null default 'live' check (status in ('live','ended','revoked')),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  constraint ended_after_start check (ended_at is null or ended_at >= started_at)
);
create index on streams (room_id, started_at desc);
create index on streams (streamer_id, started_at desc);
-- One live screen share per person per room.
create unique index one_live_stream_per_user_room
  on streams (room_id, streamer_id) where status = 'live';

create table stream_views (
  id          uuid primary key default gen_random_uuid(),
  stream_id   uuid not null references streams(id) on delete cascade,
  viewer_id   uuid not null references profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  livekit_region text
);
create index on stream_views (stream_id);
create index on stream_views (viewer_id);

-- LiveKit also retries webhooks.
create table livekit_events (
  id          text primary key,              -- event.id from the webhook
  type        text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- lockdown
alter table plans          enable row level security;
alter table profiles       enable row level security;
alter table subscriptions  enable row level security;
alter table stripe_events  enable row level security;
alter table rooms          enable row level security;
alter table room_members   enable row level security;
alter table streams        enable row level security;
alter table stream_views   enable row level security;
alter table livekit_events enable row level security;
-- No policies: only the FastAPI service role reads and writes.
