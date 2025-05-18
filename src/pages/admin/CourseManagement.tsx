import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const defaultForm: TablesInsert<'courses'> = {
  title: '',
  description: '',
  cover_image: '',
  status: 'draft',
};

const statusMap: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
};

// 章节类型
interface SectionWithVideo {
  id: string;
  title: string;
  description: string | null;
  order: number;
  video_id: string | null;
  video?: {
    id: string;
    title: string;
    video_url: string;
  } | null;
}

// 课程类型
interface CourseWithSections extends Omit<Tables<'courses'>, 'price'> {
  sections: SectionWithVideo[];
}

// 章节编辑弹窗初始值
const defaultSectionForm = {
  id: '',
  title: '',
  description: '',
  order: 1,
  video_id: '',
  video: null as SectionWithVideo['video'] | null,
};

// 视频类型
interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  created_at: string;
}

// 新增课程表单类型（包含章节）
interface NewCourseForm extends TablesInsert<'courses'> {
  sections: {
    title: string;
    description: string | null;
    order: number;
    video_id: string | null;
    video: Video | null;
  }[];
}

const CourseManagement = () => {
  const [courses, setCourses] = useState<CourseWithSections[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewCourseForm>({...defaultForm, sections: []});
  const [submitting, setSubmitting] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: '', title: '' });
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; courseId: string; section?: SectionWithVideo }>({ open: false, mode: 'add', courseId: '', section: undefined });
  const [sectionForm, setSectionForm] = useState<typeof defaultSectionForm>(defaultSectionForm);
  const [videoUploadDialog, setVideoUploadDialog] = useState<{ open: boolean; sectionId: string; courseId: string }>({ open: false, sectionId: '', courseId: '' });
  const [videoLibrary, setVideoLibrary] = useState<Video[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [uploadedVideoTitle, setUploadedVideoTitle] = useState('');
  const videoUploadRef = useRef<HTMLInputElement>(null);

  // 获取课程及章节和视频信息
  const fetchCourses = async () => {
    setLoading(true);
    // 查询课程
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, cover_image, status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (courseError || !courseData) {
      setCourses([]);
      setLoading(false);
      return;
    }
    // 查询所有章节及视频
    const { data: sectionData, error: sectionError } = await supabase
      .from("course_sections")
      .select("id, title, description, order, course_id, video_id, videos(id, title, video_url)")
      .order("order", { ascending: true });
    if (sectionError || !sectionData) {
      setCourses(courseData.map(c => ({ ...c, sections: [] })));
      setLoading(false);
      return;
    }
    // 按课程分组章节
    const courseMap: Record<string, SectionWithVideo[]> = {};
    sectionData.forEach((s: any) => {
      if (!s.course_id) return;
      if (!courseMap[s.course_id]) courseMap[s.course_id] = [];
      courseMap[s.course_id].push({
        id: s.id,
        title: s.title,
        description: s.description,
        order: s.order,
        video_id: s.video_id,
        video: s.videos ? {
          id: s.videos.id,
          title: s.videos.title,
          video_url: s.videos.video_url,
        } : null,
      });
    });
    // 合并到课程
    setCourses(courseData.map(c => ({ ...c, sections: courseMap[c.id] || [] })));
    setLoading(false);
  };

  // 获取视频库
  const fetchVideoLibrary = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("id, title, description, video_url, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setVideoLibrary(data);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchVideoLibrary();
  }, []);

  // 处理表单输入
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 提交新增课程
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // 1. 插入课程
      const { data: courseData, error: courseError } = await supabase.from('courses').insert([{
        title: form.title,
        description: form.description,
        cover_image: form.cover_image,
        status: form.status,
      }]).select('id').single();
      
      if (courseError || !courseData?.id) {
        throw new Error('新增课程失败：' + courseError?.message);
      }
      
      // 2. 如果有章节，批量插入
      if (form.sections.length > 0) {
        const sections = form.sections.map((section, idx) => ({
          course_id: courseData.id,
          title: section.title,
          description: section.description,
          order: section.order || idx + 1,
          video_id: section.video_id,
        }));
        
        const { error: sectionError } = await supabase.from('course_sections').insert(sections);
        if (sectionError) {
          throw new Error('新增章节失败：' + sectionError.message);
        }
      }
      
      setOpen(false);
      setForm({...defaultForm, sections: []});
      fetchCourses();
    } catch (error: any) {
      alert(error.message || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 播放视频
  const handlePlayVideo = (url: string, title: string) => {
    setVideoDialog({ open: true, url, title });
  };

  // 打开新增/编辑章节弹窗
  const openSectionDialog = (mode: 'add' | 'edit', courseId: string, section?: SectionWithVideo) => {
    setSectionDialog({ open: true, mode, courseId, section });
    if (mode === 'edit' && section) {
      setSectionForm({
        id: section.id,
        title: section.title,
        description: section.description || '',
        order: section.order,
        video_id: section.video_id || '',
        video: section.video || null,
      });
    } else {
      // 对于现有课程，找到最大order值+1作为新章节的order
      const maxOrder = courseId ? Math.max(0, ...courses.find(c => c.id === courseId)?.sections.map(s => s.order) || [0]) : 0;
      setSectionForm({ ...defaultSectionForm, order: maxOrder + 1 });
    }
  };

  // 关闭章节弹窗
  const closeSectionDialog = () => {
    setSectionDialog({ open: false, mode: 'add', courseId: '', section: undefined });
    setSectionForm(defaultSectionForm);
  };

  // 章节表单输入
  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSectionForm((prev) => ({ ...prev, [name]: value }));
  };

  // 新增/编辑章节提交
  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.title) return alert('章节标题不能为空');
    
    try {
      if (sectionDialog.mode === 'add') {
        // 新增章节
        await supabase.from('course_sections').insert([{
          course_id: sectionDialog.courseId,
          title: sectionForm.title,
          description: sectionForm.description,
          order: sectionForm.order,
          video_id: sectionForm.video_id || null,
        }]);
      } else if (sectionDialog.mode === 'edit' && sectionForm.id) {
        // 编辑章节
        await supabase.from('course_sections').update({
          title: sectionForm.title,
          description: sectionForm.description,
          order: sectionForm.order,
          video_id: sectionForm.video_id || null,
        }).eq('id', sectionForm.id);
      }
      closeSectionDialog();
      fetchCourses();
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  // 删除章节
  const handleDeleteSection = async (sectionId: string) => {
    if (!window.confirm('确定要删除该章节吗？')) return;
    try {
      await supabase.from('course_sections').delete().eq('id', sectionId);
      fetchCourses();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  // 打开视频上传/选择弹窗
  const openVideoDialog = (sectionId: string, courseId: string) => {
    setVideoUploadDialog({ open: true, sectionId, courseId });
    fetchVideoLibrary(); // 重新加载视频库
    setSelectedVideoId('');
    setUploadedVideoTitle('');
  };

  // 关闭视频上传/选择弹窗
  const closeVideoDialog = () => {
    setVideoUploadDialog({ open: false, sectionId: '', courseId: '' });
    setSelectedVideoId('');
    setUploadedVideoTitle('');
  };

  // 视频选择
  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
  };

  // 视频上传
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('video/')) {
      return alert('请选择视频文件');
    }
    
    try {
      setUploadingVideo(true);
      
      // 1. 上传到 Storage
      const videoName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos') // 需要先在 Supabase 创建名为 videos 的 bucket
        .upload(videoName, file);
      
      if (uploadError) throw new Error('视频上传失败：' + uploadError.message);
      
      // 2. 获取公开URL
      const { data: urlData } = await supabase.storage
        .from('videos')
        .getPublicUrl(videoName);
      
      const videoUrl = urlData?.publicUrl;
      
      // 3. 保存到视频表
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([{
          title: uploadedVideoTitle || file.name,
          video_url: videoUrl,
        }])
        .select('id')
        .single();
      
      if (insertError) throw new Error('保存视频信息失败：' + insertError.message);
      
      setSelectedVideoId(videoData.id);
      fetchVideoLibrary(); // 刷新视频库
      
      if (event.target.files) {
        event.target.value = '';
      }
    } catch (error: any) {
      alert(error.message || '上传失败');
    } finally {
      setUploadingVideo(false);
    }
  };

  // 应用所选视频到章节
  const applyVideoToSection = async () => {
    if (!selectedVideoId || !videoUploadDialog.sectionId) return;
    
    try {
      // 更新章节的 video_id
      await supabase
        .from('course_sections')
        .update({ video_id: selectedVideoId })
        .eq('id', videoUploadDialog.sectionId);
      
      fetchCourses();
      closeVideoDialog();
    } catch (error: any) {
      alert(error.message || '设置视频失败');
    }
  };

  // 新增课程中添加章节
  const addSectionToNewCourse = () => {
    const newOrder = form.sections.length > 0 
      ? Math.max(...form.sections.map(s => s.order || 0)) + 1 
      : 1;
      
    setForm(prev => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          title: '',
          description: '',
          order: newOrder,
          video_id: null,
          video: null
        }
      ]
    }));
  };

  // 从新增课程中删除章节
  const removeSectionFromNewCourse = (index: number) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  // 处理新增课程中章节表单输入
  const handleNewCourseSectionChange = (index: number, field: string, value: string) => {
    setForm(prev => {
      const updatedSections = [...prev.sections];
      updatedSections[index] = {
        ...updatedSections[index],
        [field]: field === 'order' ? Number(value) : value
      };
      return { ...prev, sections: updatedSections };
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">课程管理</h2>
        <Button onClick={() => setOpen(true)}>新增课程</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>课程列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>加载中...</div>
          ) : courses.length === 0 ? (
            <div>暂无课程</div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {courses.map((course) => (
                <AccordionItem value={course.id} key={course.id}>
                  <AccordionTrigger>
                    <div className="flex flex-col md:flex-row md:items-center w-full justify-between">
                      <span className="font-medium text-lg">{course.title}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{statusMap[course.status] || course.status}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-2 text-gray-700">{course.description}</div>
                    {course.sections.length === 0 ? (
                      <div className="text-muted-foreground">暂无章节</div>
                    ) : (
                      <table className="w-full text-sm border mt-2">
                        <thead>
                          <tr>
                            <th className="py-1 px-2">序号</th>
                            <th className="py-1 px-2">章节标题</th>
                            <th className="py-1 px-2">视频</th>
                            <th className="py-1 px-2">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {course.sections.map((section, idx) => (
                            <tr key={section.id} className="border-b">
                              <td className="py-1 px-2">{section.order}</td>
                              <td className="py-1 px-2">{section.title}</td>
                              <td className="py-1 px-2">{section.video?.title || '无视频'}</td>
                              <td className="py-1 px-2 flex flex-wrap gap-1">
                                {section.video?.video_url ? (
                                  <Button size="sm" onClick={() => handlePlayVideo(section.video!.video_url, section.video!.title)}>播放</Button>
                                ) : (
                                  <span className="text-muted-foreground">无视频</span>
                                )}
                                <Button size="sm" variant="outline" onClick={() => openSectionDialog('edit', course.id, section)}>编辑</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteSection(section.id)}>删除</Button>
                                <Button size="sm" variant="secondary" onClick={() => openVideoDialog(section.id, course.id)}>视频</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="mt-4">
                      <Button size="sm" onClick={() => openSectionDialog('add', course.id)}>新增章节</Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      {/* 新增课程弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增课程</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">标题 *</label>
              <Input name="title" value={form.title} onChange={handleChange} required maxLength={100} placeholder="请输入课程标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">描述</label>
              <Textarea name="description" value={form.description || ''} onChange={handleChange} maxLength={500} placeholder="请输入课程描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">封面图片URL</label>
              <Input name="cover_image" value={form.cover_image || ''} onChange={handleChange} placeholder="请输入图片链接（可选）" />
            </div>
            <div>
              <label className="block mb-1 font-medium">状态</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-2 py-1">
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
              </select>
            </div>
            
            {/* 章节列表 */}
            <div className="border p-4 rounded">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">章节（可选）</h3>
                <Button type="button" size="sm" onClick={addSectionToNewCourse}>添加章节</Button>
              </div>
              
              {form.sections.length === 0 ? (
                <div className="text-muted-foreground">暂无章节，点击"添加章节"添加</div>
              ) : (
                <div className="space-y-4">
                  {form.sections.map((section, idx) => (
                    <div key={idx} className="border p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">章节 {idx + 1}</h4>
                        <Button type="button" size="sm" variant="destructive" onClick={() => removeSectionFromNewCourse(idx)}>删除</Button>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm font-medium">标题 *</label>
                          <Input 
                            value={section.title} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'title', e.target.value)}
                            placeholder="请输入章节标题" 
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">描述</label>
                          <Textarea 
                            value={section.description || ''} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'description', e.target.value)}
                            placeholder="请输入章节描述" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium">排序</label>
                          <Input 
                            type="number"
                            min={1}
                            value={section.order} 
                            onChange={(e) => handleNewCourseSectionChange(idx, 'order', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>取消</Button>
              <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : '提交'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* 章节编辑弹窗 */}
      <Dialog open={sectionDialog.open} onOpenChange={closeSectionDialog}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{sectionDialog.mode === 'add' ? '新增章节' : '编辑章节'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">章节标题 *</label>
              <Input name="title" value={sectionForm.title} onChange={handleSectionChange} required maxLength={100} placeholder="请输入章节标题" />
            </div>
            <div>
              <label className="block mb-1 font-medium">章节描述</label>
              <Textarea name="description" value={sectionForm.description || ''} onChange={handleSectionChange} maxLength={500} placeholder="请输入章节描述" />
            </div>
            <div>
              <label className="block mb-1 font-medium">排序（数字越小越靠前）</label>
              <Input name="order" type="number" min={1} value={sectionForm.order} onChange={handleSectionChange} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeSectionDialog}>取消</Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* 视频上传/选择弹窗 */}
      <Dialog open={videoUploadDialog.open} onOpenChange={closeVideoDialog}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>视频上传/选择</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="upload">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">上传新视频</TabsTrigger>
              <TabsTrigger value="select">选择现有视频</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4 py-4">
              <div>
                <label className="block mb-1 font-medium">视频标题</label>
                <Input value={uploadedVideoTitle} onChange={(e) => setUploadedVideoTitle(e.target.value)} placeholder="请输入视频标题（可选）" />
              </div>
              <div>
                <label className="block mb-1 font-medium">上传视频文件</label>
                <Input 
                  type="file" 
                  ref={videoUploadRef}
                  accept="video/*" 
                  onChange={handleVideoUpload}
                  disabled={uploadingVideo}
                />
                {uploadingVideo && <div className="mt-2 text-sm">上传中，请稍候...</div>}
              </div>
            </TabsContent>
            
            <TabsContent value="select" className="py-4">
              <div className="h-[400px] overflow-y-auto border rounded">
                {videoLibrary.length === 0 ? (
                  <div className="flex items-center justify-center h-full">暂无视频</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                    {videoLibrary.map(video => (
                      <div 
                        key={video.id} 
                        className={`border rounded p-2 cursor-pointer ${selectedVideoId === video.id ? 'bg-primary/10 border-primary' : ''}`}
                        onClick={() => handleVideoSelect(video.id)}
                      >
                        <div className="font-medium">{video.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{video.video_url}</div>
                        <div className="text-xs text-muted-foreground">{new Date(video.created_at).toLocaleString('zh-CN')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeVideoDialog}>取消</Button>
            <Button 
              type="button" 
              onClick={applyVideoToSection} 
              disabled={!selectedVideoId || uploadingVideo}
            >
              应用所选视频
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 视频播放弹窗 */}
      <Dialog open={videoDialog.open} onOpenChange={open => setVideoDialog(v => ({ ...v, open }))}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>{videoDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            {videoDialog.url ? (
              <video src={videoDialog.url} controls className="w-full h-full max-h-[60vh] bg-black" autoPlay />
            ) : (
              <span className="text-white">无视频资源</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseManagement; 