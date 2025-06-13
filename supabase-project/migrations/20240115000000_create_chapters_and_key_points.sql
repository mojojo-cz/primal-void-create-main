-- 创建章节和考点的两层结构
-- 1. 创建章节表 (chapters)
CREATE TABLE public.chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. 创建考点表 (key_points)  
CREATE TABLE public.key_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL DEFAULT 1,
  video_id UUID REFERENCES public.minio_videos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. 为性能优化添加索引
CREATE INDEX idx_chapters_course_id ON public.chapters(course_id);
CREATE INDEX idx_chapters_order ON public.chapters("order");
CREATE INDEX idx_key_points_chapter_id ON public.key_points(chapter_id);
CREATE INDEX idx_key_points_order ON public.key_points("order");
CREATE INDEX idx_key_points_video_id ON public.key_points(video_id);

-- 4. 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chapters_updated_at 
  BEFORE UPDATE ON public.chapters 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_points_updated_at 
  BEFORE UPDATE ON public.key_points 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. 启用RLS (Row Level Security)
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_points ENABLE ROW LEVEL SECURITY;

-- 6. 创建RLS策略
CREATE POLICY "Allow all operations for authenticated users" ON public.chapters
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON public.key_points
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. 注释说明
COMMENT ON TABLE public.chapters IS '课程章节表';
COMMENT ON TABLE public.key_points IS '章节考点表';
COMMENT ON COLUMN public.chapters.course_id IS '所属课程ID';
COMMENT ON COLUMN public.chapters.title IS '章节标题';
COMMENT ON COLUMN public.chapters.description IS '章节描述';
COMMENT ON COLUMN public.chapters."order" IS '章节排序';
COMMENT ON COLUMN public.key_points.chapter_id IS '所属章节ID';
COMMENT ON COLUMN public.key_points.title IS '考点标题';
COMMENT ON COLUMN public.key_points.description IS '考点描述';
COMMENT ON COLUMN public.key_points."order" IS '考点排序';
COMMENT ON COLUMN public.key_points.video_id IS '关联视频ID'; 