-- 创建MinIO视频表
create table if not exists public.minio_videos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  video_url text not null,
  minio_object_name text not null unique,
  file_size bigint,
  content_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用RLS
alter table public.minio_videos enable row level security;

-- 创建RLS策略
create policy "允许认证用户查看MinIO视频" on public.minio_videos
  for select using (auth.role() = 'authenticated');

create policy "允许认证用户插入MinIO视频" on public.minio_videos
  for insert with check (auth.role() = 'authenticated');

create policy "允许认证用户更新MinIO视频" on public.minio_videos
  for update using (auth.role() = 'authenticated');

create policy "允许认证用户删除MinIO视频" on public.minio_videos
  for delete using (auth.role() = 'authenticated');

-- 创建索引
create index idx_minio_videos_created_at on public.minio_videos(created_at desc);
create index idx_minio_videos_object_name on public.minio_videos(minio_object_name);

-- 添加更新时间戳触发器
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_minio_videos_updated_at
  before update on public.minio_videos
  for each row
  execute function public.handle_updated_at(); 