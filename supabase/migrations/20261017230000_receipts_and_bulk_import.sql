-- Private receipts and an atomic, invoker-rights import. No existing financial rows are modified.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deu-bom-comprovantes', 'deu-bom-comprovantes', false, 3145728,
  array['image/jpeg','image/png','image/webp','application/pdf']) on conflict (id) do nothing;

create table if not exists public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 150),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  created_at timestamptz not null default now(),
  unique(transaction_id, storage_path)
);
alter table public.transaction_attachments enable row level security;
revoke all on public.transaction_attachments from anon;
grant select, insert, delete on public.transaction_attachments to authenticated;
grant all on public.transaction_attachments to service_role;
create index if not exists transaction_attachments_path_idx on public.transaction_attachments(storage_path);
drop policy if exists "Read accessible receipts" on public.transaction_attachments;
create policy "Read accessible receipts" on public.transaction_attachments for select to authenticated using
 (user_id = auth.uid() or exists(select 1 from public.transactions t where t.id = transaction_id));
drop policy if exists "Attach to editable transactions" on public.transaction_attachments;
create policy "Attach to editable transactions" on public.transaction_attachments for insert to authenticated with check
 (user_id = auth.uid() and split_part(storage_path, '/', 1) = auth.uid()::text and exists(
  select 1 from public.transactions t where t.id = transaction_id and
   ((t.workspace_id is null and t.user_id = auth.uid()) or (t.workspace_id is not null and public.can_edit_workspace(t.workspace_id, auth.uid())))
 ));
drop policy if exists "Remove editable receipt links" on public.transaction_attachments;
create policy "Remove editable receipt links" on public.transaction_attachments for delete to authenticated using
 (user_id = auth.uid() or exists(select 1 from public.transactions t where t.id = transaction_id and t.workspace_id is not null and public.can_edit_workspace(t.workspace_id, auth.uid())));

drop policy if exists "Upload private financial receipts" on storage.objects;
create policy "Upload private financial receipts" on storage.objects for insert to authenticated with check
 (bucket_id = 'deu-bom-comprovantes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Read private financial receipts" on storage.objects;
create policy "Read private financial receipts" on storage.objects for select to authenticated using
 (bucket_id = 'deu-bom-comprovantes' and ((storage.foldername(name))[1] = auth.uid()::text or exists(
  select 1 from public.transaction_attachments a where a.storage_path = name
 )));
drop policy if exists "Remove unused owned receipts" on storage.objects;
create policy "Remove unused owned receipts" on storage.objects for delete to authenticated using
 (bucket_id = 'deu-bom-comprovantes' and (storage.foldername(name))[1] = auth.uid()::text and not exists(
  select 1 from public.transaction_attachments a where a.storage_path = name
 ));

create or replace function public.import_finance_batch(batch jsonb, target_workspace uuid default null, receipt jsonb default null)
returns integer language plpgsql security invoker set search_path = public as $$
declare inserted integer; entry record;
begin
 if auth.uid() is null then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 if target_workspace is not null and not public.can_edit_workspace(target_workspace, auth.uid()) then
  raise exception 'Sem permissão para importar nesta equipe' using errcode='42501';
 end if;
 if batch is null or jsonb_typeof(batch) is distinct from 'array' or jsonb_array_length(batch) not between 1 and 1000 then raise exception 'Lote inválido'; end if;
 for entry in select * from jsonb_to_recordset(batch) as x(id uuid,title text,amount numeric,type text,status text,category_id uuid,date date,notes text,recurrence_type text,installment_number integer,total_installments integer,group_id uuid) loop
  if entry.id is null or entry.date is null or entry.amount is null or entry.amount <= 0 or entry.amount <> round(entry.amount,2)
   or entry.title is null or char_length(trim(entry.title)) not between 1 and 200
   or entry.type is null or entry.type not in ('income','expense') or entry.status is null or entry.status not in ('pending','completed')
   or entry.recurrence_type is null or entry.recurrence_type not in ('none','installment') then raise exception 'Lançamento inválido no lote'; end if;
  if entry.recurrence_type = 'installment' and (entry.group_id is null or entry.total_installments is null or entry.total_installments not between 2 and 360 or entry.installment_number is null or entry.installment_number not between 1 and entry.total_installments) then raise exception 'Parcelamento inválido'; end if;
  if entry.category_id is not null and not exists(select 1 from public.categories c where c.id = entry.category_id and c.type = entry.type and c.workspace_id is not distinct from target_workspace and (target_workspace is not null or c.user_id = auth.uid())) then raise exception 'Categoria fora do contexto'; end if;
 end loop;
 insert into public.transactions(id,user_id,workspace_id,title,amount,type,status,category_id,date,notes,recurrence_type,installment_number,total_installments,group_id,notify)
 select x.id,auth.uid(),target_workspace,x.title,x.amount,x.type,x.status,x.category_id,x.date,x.notes,x.recurrence_type,x.installment_number,x.total_installments,x.group_id,false
 from jsonb_to_recordset(batch) as x(id uuid,title text,amount numeric,type text,status text,category_id uuid,date date,notes text,recurrence_type text,installment_number integer,total_installments integer,group_id uuid)
 on conflict(id) do nothing;
 get diagnostics inserted = row_count;
 if exists(select 1 from jsonb_array_elements(batch) b where not exists(select 1 from public.transactions t where t.id=(b->>'id')::uuid and t.user_id=auth.uid() and t.workspace_id is not distinct from target_workspace)) then raise exception 'Identificador fora do contexto' using errcode='42501'; end if;
 if receipt is not null then
  if split_part(receipt->>'storage_path','/',1) <> auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='deu-bom-comprovantes' and o.name=receipt->>'storage_path') then raise exception 'Comprovante privado não encontrado'; end if;
  insert into public.transaction_attachments(transaction_id,user_id,storage_path,file_name,content_type,size_bytes)
  select (b->>'id')::uuid,auth.uid(),receipt->>'storage_path',receipt->>'file_name',receipt->>'content_type',(receipt->>'size_bytes')::integer
  from jsonb_array_elements(batch) b on conflict(transaction_id,storage_path) do nothing;
 end if;
 return inserted;
end $$;
revoke all on function public.import_finance_batch(jsonb,uuid,jsonb) from public,anon;
grant execute on function public.import_finance_batch(jsonb,uuid,jsonb) to authenticated;

create table if not exists public.document_import_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, used integer not null default 0 check(used >= 0), primary key(user_id,day)
);
alter table public.document_import_usage enable row level security;
revoke all on public.document_import_usage from anon,authenticated;
grant all on public.document_import_usage to service_role;
create or replace function public.reserve_document_import(request_user uuid) returns integer language plpgsql security invoker set search_path=public as $$
declare amount integer;
begin
 insert into public.document_import_usage(user_id,day,used) values(request_user,(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set used=document_import_usage.used+1 where document_import_usage.used < 30 returning used into amount;
 if amount is null then raise exception 'Limite diário de leituras atingido'; end if;
 return amount;
end $$;
revoke all on function public.reserve_document_import(uuid) from public,anon,authenticated;
grant execute on function public.reserve_document_import(uuid) to service_role;
