-- 更新course_sections表的video_id外键关系
-- 从videos表改为指向minio_videos表

-- 1. 删除现有的外键约束
ALTER TABLE public.course_sections 
DROP CONSTRAINT IF EXISTS course_sections_video_id_fkey;

-- 2. 添加新的外键约束，指向minio_videos表
ALTER TABLE public.course_sections 
ADD CONSTRAINT course_sections_video_id_fkey 
FOREIGN KEY (video_id) 
REFERENCES public.minio_videos(id) 
ON DELETE SET NULL;

-- 3. 添加注释说明
COMMENT ON CONSTRAINT course_sections_video_id_fkey ON public.course_sections 
IS 'Foreign key constraint linking course sections to MinIO videos'; 