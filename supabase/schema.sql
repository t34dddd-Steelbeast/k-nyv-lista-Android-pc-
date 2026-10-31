-- Polc: könyvtár, saját listák és eszközök közötti szinkronizálás.
-- Új telepítésnél vagy frissítéskor is biztonságosan lefuttatható a Supabase SQL Editorában.

create table if not exists public.book_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists book_lists_user_name_idx on public.book_lists (user_id, lower(name));
alter table public.book_lists enable row level security;

grant select, insert, update, delete on public.book_lists to authenticated;

drop policy if exists "Users can read own book lists" on public.book_lists;
create policy "Users can read own book lists" on public.book_lists
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own book lists" on public.book_lists;
create policy "Users can add own book lists" on public.book_lists
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own book lists" on public.book_lists;
create policy "Users can update own book lists" on public.book_lists
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own book lists" on public.book_lists;
create policy "Users can delete own book lists" on public.book_lists
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  author text not null check (char_length(author) between 1 and 120),
  format text not null default 'book' check (format in ('book', 'ebook', 'audio')),
  status text not null default 'Olvasatlan' check (status in ('Olvasatlan', 'Olvasom', 'Elolvastam', 'Félbehagytam')),
  category text,
  isbn text,
  publisher text,
  publication_year integer check (publication_year is null or publication_year between 1000 and 2100),
  page_count integer check (page_count is null or page_count between 1 and 100000),
  cover_url text,
  custom_list_id uuid references public.book_lists(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A meglévő Polc adatbázisok frissítése az új mezőkkel.
alter table public.books add column if not exists publisher text;
alter table public.books add column if not exists publication_year integer;
alter table public.books add column if not exists page_count integer;
alter table public.books add column if not exists cover_url text;
alter table public.books add column if not exists custom_list_id uuid references public.book_lists(id) on delete set null;

create index if not exists books_user_updated_idx on public.books (user_id, updated_at desc);
create index if not exists books_user_list_idx on public.books (user_id, custom_list_id);
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

