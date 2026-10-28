-- Allow the leave/vacation collections through apply_sync_ops().
-- The function body matches 0001, with 'vacations' and 'vacationBalances'
-- added to the allow-list so leave requests sync across devices.

create or replace function public.apply_sync_ops(p_ops jsonb, p_seed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_allowed constant text[] := array[
        'bookings', 'users', 'removedUsers', 'passwordRequests',
        'changeRequests', 'notifications', 'buses', 'audit', 'sheet',
        'vacations', 'vacationBalances'
    ];
    v_rev  bigint;
    v_op   jsonb;
    v_name text;
    v_item jsonb;
    v_id   text;
begin
    if p_seed then
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

revoke all on function public.apply_sync_ops(jsonb, boolean) from public;
revoke all on function public.apply_sync_ops(jsonb, boolean) from anon;
revoke all on function public.apply_sync_ops(jsonb, boolean) from authenticated;
grant execute on function public.apply_sync_ops(jsonb, boolean) to service_role;
