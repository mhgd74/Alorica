-- Shared state for the Alorica transport booking app.
--
-- The client replicates a handful of named collections (bookings, users,
-- notifications, ...). Rather than one table per collection, everything lives
-- in a single document table keyed by (collection, id) — this mirrors the
-- storage shape the app already used locally, so the sync layer keeps working
-- unchanged while the data becomes genuinely shared.
--
-- Writes go through apply_sync_ops(), which applies a whole batch inside one
-- transaction and bumps a revision counter. Clients poll/susbcribe to that
-- counter to know when their replica is stale.

create table if not exists public.items (
    collection text        not null,
    id         text        not null,
    data       jsonb       not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (collection, id)
);

create index if not exists items_collection_idx on public.items (collection);

-- A single row holding the current revision.
create table if not exists public.sync_meta (
    id  boolean primary key default true,
    rev bigint  not null default 0,
    constraint sync_meta_is_single_row check (id)
);

insert into public.sync_meta (id, rev) values (true, 0)
on conflict (id) do nothing;

-- Only the server (which holds the service role key) may touch these tables
-- directly. The browser never talks to them before it has been authenticated.
alter table public.items     enable row level security;
alter table public.sync_meta enable row level security;

-- Applies a batch of operations and returns the new revision.
--
-- Expected payload:
--   [ { "collection": "bookings",
--       "replace": true,                 -- optional: wipe the collection first
--       "remove":  ["id1", "id2"],       -- optional
--       "upsert":  [ {...}, "value" ] }  -- optional; objects keyed by id/username
--   ]
--
-- When p_seed is true the batch is only accepted while the revision is still
-- zero, so two clients starting at the same time cannot both claim the seed.
create or replace function public.apply_sync_ops(p_ops jsonb, p_seed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_allowed constant text[] := array[
        'bookings', 'users', 'removedUsers', 'passwordRequests',
        'changeRequests', 'notifications', 'buses', 'audit', 'sheet'
    ];
    v_rev  bigint;
    v_op   jsonb;
    v_name text;
    v_item jsonb;
    v_id   text;
begin
    if p_seed then
        -- Take the row lock before reading, so a second seed waits here and
        -- then sees a non-zero revision.
        select rev into v_rev from public.sync_meta where id = true for update;
        if v_rev <> 0 then
            return jsonb_build_object('seeded', false, 'rev', v_rev);
        end if;
    end if;

    for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
    loop
        v_name := v_op->>'collection';
        if v_name is null or not (v_name = any (v_allowed)) then
            continue;
        end if;

        if coalesce((v_op->>'replace')::boolean, false) then
            delete from public.items where collection = v_name;
        end if;

        for v_id in select jsonb_array_elements_text(coalesce(v_op->'remove', '[]'::jsonb))
        loop
            delete from public.items where collection = v_name and id = v_id;
        end loop;

        for v_item in select value from jsonb_array_elements(coalesce(v_op->'upsert', '[]'::jsonb))
        loop
            v_id := case
                when jsonb_typeof(v_item) = 'object'
                    then coalesce(v_item->>'id', v_item->>'username')
                else v_item #>> '{}'
            end;
            if v_id is null then
                continue;
            end if;

            insert into public.items (collection, id, data, updated_at)
            values (v_name, v_id, v_item, now())
            on conflict (collection, id)
            do update set data = excluded.data, updated_at = now();
        end loop;
    end loop;

    update public.sync_meta set rev = rev + 1 where id = true returning rev into v_rev;
    return jsonb_build_object('seeded', true, 'rev', v_rev);
end;
$$;

-- The function is the only write path. Only the server holds the service role
-- key, so nothing else gets to call it.
revoke all on function public.apply_sync_ops(jsonb, boolean) from public;
revoke all on function public.apply_sync_ops(jsonb, boolean) from anon;
revoke all on function public.apply_sync_ops(jsonb, boolean) from authenticated;
grant execute on function public.apply_sync_ops(jsonb, boolean) to service_role;
