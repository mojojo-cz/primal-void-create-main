-- 创建 minio_videos 表
CREATE TABLE public.minio_videos (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    minio_object_name TEXT NOT NULL UNIQUE,
    file_size BIGINT,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_minio_videos_created_at ON public.minio_videos(created_at DESC);
CREATE INDEX idx_minio_videos_title ON public.minio_videos(title);

-- 启用 RLS
ALTER TABLE public.minio_videos ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有用户读取
CREATE POLICY "Allow public read access" ON public.minio_videos
    FOR SELECT USING (true);

-- 创建策略：允许所有用户插入
CREATE POLICY "Allow public insert access" ON public.minio_videos
    FOR INSERT WITH CHECK (true);

-- 创建策略：允许所有用户更新
CREATE POLICY "Allow public update access" ON public.minio_videos
    FOR UPDATE USING (true);

-- 创建策略：允许所有用户删除
CREATE POLICY "Allow public delete access" ON public.minio_videos
    FOR DELETE USING (true);

-- 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_minio_videos_updated_at
    BEFORE UPDATE ON public.minio_videos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 