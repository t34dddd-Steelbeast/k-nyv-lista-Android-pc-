-- Polc: saját, eszközök között szinkronizált könyvtár
-- Futtasd egyszer a Supabase projekt SQL Editorában.

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  author text not null check (char_length(author) between 1 and 120),
  format text not null default 'book' check (format in ('book', 'ebook', 'audio')),
  status text not null default 'Olvasatlan' check (status in ('Olvasatlan', 'Olvasom', 'Elolvastam', 'Félbehagytam')),
  category text,
  isbn text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_user_updated_idx on public.books (user_id, updated_at desc);
alter table public.books enable row level security;

grant select, insert, update, delete on public.books to authenticated;

drop policy if exists "Users can read own books" on public.books;
create policy "Users can read own books" on public.books
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own books" on public.books;
create policy "Users can add own books" on public.books
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own books" on public.books;
create policy "Users can update own books" on public.books
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own books" on public.books;
create policy "Users can delete own books" on public.books
  for delete to authenticated
  using ((select auth.uid()) = user_id);

