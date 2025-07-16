import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit,
  Trash2,
  Search,
  MapPin,
  Building,
  Users,
  Settings,
  Filter,
  RotateCcw,
  Calendar
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import EnhancedPagination from "@/components/ui/enhanced-pagination";
import { getCurrentPageSize, setPageSize } from "@/utils/userPreferences";
import { formatDateForDisplay } from '@/utils/timezone';

// 场地类型定义
type VenueType = 'classroom' | 'conference_room';
type VenueStatus = 'available' | 'maintenance' | 'unavailable';

interface Venue {
  id: string;
  name: string;
  type: VenueType;
  capacity: number | null;
  details: string | null;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
}

// 状态选项配置
const VENUE_TYPES = [
  { value: 'classroom', label: '教室', icon: <Building className="h-4 w-4" /> },
  { value: 'conference_room', label: '会议室', icon: <Users className="h-4 w-4" /> }
];

const VENUE_STATUSES = [
  { value: 'available', label: '可用', color: 'bg-green-100 text-green-800' },
  { value: 'maintenance', label: '维修中', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'unavailable', label: '不可用', color: 'bg-red-100 text-red-800' }
];

const VenueManagement = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setCurrentPageSize] = useState(() => getCurrentPageSize());
  const [totalCount, setTotalCount] = useState(0);

  // 筛选状态
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // 对话框状态
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; venue?: Venue }>({ 
    open: false, 
    venue: undefined 
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; venueId: string }>({
    open: false,
    venueId: ""
  });

  // 表单状态
  const [venueForm, setVenueForm] = useState({
    name: "",
    type: "classroom" as VenueType,
    capacity: "",
    details: "",
    status: "available" as VenueStatus
  });
  const [submitting, setSubmitting] = useState(false);

  // 获取场地列表
  const fetchVenues = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('venues')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // 应用筛选条件
      if (filterType !== "all") {
        query = query.eq('type', filterType);
      }
      if (filterStatus !== "all") {
        query = query.eq('status', filterStatus);
      }

      // 应用搜索条件
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,details.ilike.%${searchTerm}%`);
      }

      // 应用分页
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;
      query = query.range(startIndex, endIndex);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setVenues(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("获取场地列表失败:", error);
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error.message || "无法加载场地列表"
      });
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setVenueForm({
      name: "",
      type: "classroom",
      capacity: "",
      details: "",
      status: "available"
    });
  };

  // 创建场地
  const handleCreateVenue = async () => {
    if (!venueForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "表单验证失败",
        description: "请填写场地名称"
      });
      return;
    }

    setSubmitting(true);
    try {
      const venueData = {
        name: venueForm.name.trim(),
        type: venueForm.type,
        capacity: venueForm.capacity ? parseInt(venueForm.capacity) : null,
        details: venueForm.details.trim() || null,
        status: venueForm.status
      };

      const { error } = await supabase
        .from('venues')
        .insert([venueData]);

      if (error) throw error;

      toast({
        title: "创建成功",
        description: "场地已成功创建"
      });

      setCreateDialog(false);
      resetForm();
      fetchVenues();
    } catch (error: any) {
      console.error("创建场地失败:", error);
      
      // 处理唯一性约束错误
      if (error.code === '23505') {
        toast({
          variant: "destructive",
          title: "创建失败",
          description: "该场地名称和类型的组合已存在，请使用不同的名称"
        });
      } else {
        toast({
          variant: "destructive",
          title: "创建失败",
          description: error.message || "创建场地时发生错误"
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 打开编辑对话框
  const openEditDialog = (venue: Venue) => {
    setVenueForm({
      name: venue.name,
      type: venue.type,
      capacity: venue.capacity?.toString() || "",
      details: venue.details || "",
      status: venue.status
    });
    setEditDialog({ open: true, venue });
  };

  // 关闭编辑对话框
  const closeEditDialog = () => {
    setEditDialog({ open: false, venue: undefined });
    resetForm();
  };

  // 更新场地
  const handleUpdateVenue = async () => {
    if (!editDialog.venue || !venueForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "表单验证失败",
        description: "请填写场地名称"
      });
      return;
    }

    setSubmitting(true);
    try {
      const venueData = {
        name: venueForm.name.trim(),
        type: venueForm.type,
        capacity: venueForm.capacity ? parseInt(venueForm.capacity) : null,
        details: venueForm.details.trim() || null,
        status: venueForm.status
      };

      const { error } = await supabase
        .from('venues')
        .update(venueData)
        .eq('id', editDialog.venue.id);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "场地信息已成功更新"
      });

      closeEditDialog();
      fetchVenues();
    } catch (error: any) {
      console.error("更新场地失败:", error);
      
      // 处理唯一性约束错误
      if (error.code === '23505') {
        toast({
          variant: "destructive",
          title: "更新失败",
          description: "该场地名称和类型的组合已存在，请使用不同的名称"
        });
      } else {
        toast({
          variant: "destructive",
          title: "更新失败",
          description: error.message || "更新场地时发生错误"
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 删除场地
  const handleDeleteVenue = async (venueId: string) => {
    try {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', venueId);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "场地已成功删除"
      });

      setDeleteDialog({ open: false, venueId: "" });
      fetchVenues();
    } catch (error: any) {
      console.error("删除场地失败:", error);
      
      // 处理外键约束错误
      if (error.code === '23503') {
        toast({
          variant: "destructive",
          title: "删除失败",
          description: "该场地正在被排课使用，无法删除。请先删除相关排课记录。"
        });
      } else {
        toast({
          variant: "destructive",
          title: "删除失败",
          description: error.message || "删除场地时发生错误"
        });
      }
    }
  };

  // 清除筛选条件
  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理页面大小变化
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize);
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // 获取类型标签
  const getTypeLabel = (type: VenueType) => {
    return VENUE_TYPES.find(t => t.value === type)?.label || type;
  };

  // 获取状态徽章
  const getStatusBadge = (status: VenueStatus) => {
    const statusConfig = VENUE_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // 筛选后的场地数据
  const filteredVenues = venues;

  // 分页计算
  const totalPages = Math.ceil(totalCount / pageSize);

  // 页面加载时获取数据
  useEffect(() => {
    fetchVenues();
  }, [currentPage, pageSize, searchTerm, filterType, filterStatus]);

  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                场地管理
              </CardTitle>
              <Button 
                onClick={() => setCreateDialog(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                新建场地
              </Button>
            </div>
            
            {/* 搜索和筛选区域 */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">搜索场地</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="search"
                        placeholder="输入场地名称或描述..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>场地类型</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        {VENUE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              {type.icon}
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>场地状态</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        {VENUE_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button 
                      variant="outline" 
                      onClick={clearFilters}
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      清除筛选
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            </div>
          ) : (
            <>
              {/* 场地列表表格 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>场地名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>容量</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>详细信息</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVenues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="text-gray-500">
                            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>暂无场地数据</p>
                            {(searchTerm || filterType !== "all" || filterStatus !== "all") && (
                              <p className="text-sm mt-1">尝试调整搜索条件或筛选器</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVenues.map((venue) => (
                        <TableRow key={venue.id}>
                          <TableCell className="font-medium">{venue.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {VENUE_TYPES.find(t => t.value === venue.type)?.icon}
                              {getTypeLabel(venue.type)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {venue.capacity ? (
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-gray-400" />
                                {venue.capacity}人
                              </div>
                            ) : (
                              <span className="text-gray-400">未设置</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(venue.status)}</TableCell>
                          <TableCell>
                            {venue.details ? (
                              <span className="text-sm text-gray-600 line-clamp-2">
                                {venue.details}
                              </span>
                            ) : (
                              <span className="text-gray-400">无</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDateForDisplay(venue.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(venue)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteDialog({ open: true, venueId: venue.id })}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分页组件 */}
              {totalCount > 0 && (
                <div className="mt-6">
                  <EnhancedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalCount}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 创建场地对话框 */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新建场地</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                场地名称 *
              </Label>
              <Input
                id="name"
                value={venueForm.name}
                onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="如：A101"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                场地类型 *
              </Label>
              <Select 
                value={venueForm.type} 
                onValueChange={(value: VenueType) => setVenueForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="capacity" className="text-right">
                容量
              </Label>
              <Input
                id="capacity"
                type="number"
                value={venueForm.capacity}
                onChange={(e) => setVenueForm(prev => ({ ...prev, capacity: e.target.value }))}
                className="col-span-3"
                placeholder="可容纳人数"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                状态
              </Label>
              <Select 
                value={venueForm.status} 
                onValueChange={(value: VenueStatus) => setVenueForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="details" className="text-right pt-2">
                详细信息
              </Label>
              <Textarea
                id="details"
                value={venueForm.details}
                onChange={(e) => setVenueForm(prev => ({ ...prev, details: e.target.value }))}
                className="col-span-3"
                placeholder="设备配置、特殊说明等..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateVenue} disabled={submitting}>
              {submitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑场地对话框 */}
      <Dialog open={editDialog.open} onOpenChange={closeEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑场地</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                场地名称 *
              </Label>
              <Input
                id="edit-name"
                value={venueForm.name}
                onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="如：A101"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">
                场地类型 *
              </Label>
              <Select 
                value={venueForm.type} 
                onValueChange={(value: VenueType) => setVenueForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-capacity" className="text-right">
                容量
              </Label>
              <Input
                id="edit-capacity"
                type="number"
                value={venueForm.capacity}
                onChange={(e) => setVenueForm(prev => ({ ...prev, capacity: e.target.value }))}
                className="col-span-3"
                placeholder="可容纳人数"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">
                状态
              </Label>
              <Select 
                value={venueForm.status} 
                onValueChange={(value: VenueStatus) => setVenueForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENUE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-details" className="text-right pt-2">
                详细信息
              </Label>
              <Textarea
                id="edit-details"
                value={venueForm.details}
                onChange={(e) => setVenueForm(prev => ({ ...prev, details: e.target.value }))}
                className="col-span-3"
                placeholder="设备配置、特殊说明等..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              取消
            </Button>
            <Button onClick={handleUpdateVenue} disabled={submitting}>
              {submitting ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, venueId: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除这个场地吗？此操作无法撤销。
              <br />
              <strong>注意：</strong>如果该场地正在被排课使用，删除操作将失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleDeleteVenue(deleteDialog.venueId)}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VenueManagement; 