create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  embedding vector(384),
  created_at timestamp default now()
);

create or replace function match_documents(
  query_embedding vector(384),
  match_count int default 3
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
