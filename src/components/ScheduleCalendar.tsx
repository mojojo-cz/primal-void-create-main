import React, { useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, List, Grid3X3, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// FullCalendar样式将通过内联样式处理

interface ScheduleWithDetails {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  venue_id: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  lesson_title: string;
  lesson_description?: string;
  online_meeting_url?: string;
  course_hours?: number;
  status: string;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  teacher_full_name?: string;
  venue_name?: string;
  // 新增计划相关字段
  plan_name?: string;
  participants_count?: number;
}

interface ScheduleCalendarProps {
  schedules: ScheduleWithDetails[];
  onEventClick?: (schedule: ScheduleWithDetails) => void;
  onDateClick?: (date: Date) => void;
  onEventDrop?: (info: any) => void;
  loading?: boolean;
  planColorMap?: { [key: string]: string };
  schedulePlans?: any[];
  filterPlan?: string;
  onPlanFilterChange?: (plan: string) => void;
  readonly?: boolean; // 新增：只读模式
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules,
  onEventClick,
  onDateClick,
  onEventDrop,
  loading = false,
  planColorMap = {},
  schedulePlans = [],
  filterPlan = "all",
  onPlanFilterChange,
  readonly = false
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = React.useState('dayGridMonth');

  // 将排课数据转换为FullCalendar事件格式
  const events = React.useMemo(() => {
    return schedules.map(schedule => {
      const startDateTime = `${schedule.schedule_date}T${schedule.start_time}`;
      const endDateTime = `${schedule.schedule_date}T${schedule.end_time}`;
      
      // 根据课表确定颜色，如果没有计划颜色则根据状态确定
      const getPlanColor = () => {
        if (schedule.plan_name && planColorMap[schedule.plan_name]) {
          return planColorMap[schedule.plan_name];
        }
        // 回退到状态颜色
        switch (schedule.status) {
          case 'scheduled': return '#3b82f6'; // 蓝色
          case 'in_progress': return '#10b981'; // 绿色
          case 'completed': return '#6b7280'; // 灰色
          case 'cancelled': return '#ef4444'; // 红色
          default: return planColorMap['其他排课'] || '#6b7280';
        }
      };

      const eventColor = getPlanColor();

      return {
        id: schedule.id,
        title: schedule.subject_name, // 显示课程科目而不是课程主题
        start: startDateTime,
        end: endDateTime,
        backgroundColor: eventColor,
        borderColor: eventColor,
        extendedProps: {
          schedule: schedule,
          className: schedule.class_name,
          subjectName: schedule.subject_name,
          lessonTitle: schedule.lesson_title,
          teacherName: schedule.teacher_full_name || schedule.teacher_name,
          venueName: schedule.venue_name || '在线课程',
          status: schedule.status,
          planName: schedule.plan_name || '未分配计划',
          participantsCount: schedule.participants_count || 0
        }
      };
    });
  }, [schedules, planColorMap]);

  // 处理事件点击
  const handleEventClick = useCallback((info: any) => {
    if (!readonly && onEventClick) {
      onEventClick(info.event.extendedProps.schedule);
    }
  }, [readonly, onEventClick]);

  // 处理日期点击
  const handleDateClick = useCallback((info: any) => {
    if (!readonly && onDateClick) {
      onDateClick(new Date(info.date));
    }
  }, [readonly, onDateClick]);

  // 处理事件拖拽
  const handleEventDrop = useCallback((info: any) => {
    if (onEventDrop) {
      onEventDrop(info);
    }
  }, [onEventDrop]);

  // 切换视图
  const handleViewChange = (viewName: string) => {
    setCurrentView(viewName);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(viewName);
    }
  };

  // 今天按钮
  const goToToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
    }
  };

  // 上一页/下一页
  const goPrev = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
    }
  };

  const goNext = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            排课日历
          </CardTitle>
          
          {/* 视图切换和导航按钮 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 视图切换按钮 */}
            <div className="flex items-center bg-muted rounded-md p-1">
              <Button
                variant={currentView === 'dayGridMonth' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('dayGridMonth')}
                className="h-8 px-3"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                月
              </Button>
              <Button
                variant={currentView === 'timeGridWeek' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('timeGridWeek')}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1" />
                周
              </Button>
              <Button
                variant={currentView === 'timeGridDay' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('timeGridDay')}
                className="h-8 px-3"
              >
                <Clock className="h-4 w-4 mr-1" />
                日
              </Button>
            </div>

            {/* 导航按钮 */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goPrev}>
                ‹
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                今天
              </Button>
              <Button variant="outline" size="sm" onClick={goNext}>
                ›
              </Button>
            </div>
          </div>
        </div>

        {/* 课表筛选器和图例 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t">
          {/* 课表筛选器 */}
          {onPlanFilterChange && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">筛选计划：</span>
                             <select 
                 value={filterPlan} 
                 onChange={(e) => onPlanFilterChange(e.target.value)}
                 className="text-sm border rounded px-2 py-1 bg-background"
               >
                 <option value="all">全部计划</option>
                 {schedulePlans.map((plan) => (
                   <option key={plan.id} value={plan.id}>
                     {plan.name}
                   </option>
                 ))}
               </select>
            </div>
          )}
          
          {/* 课表颜色图例 */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">计划图例：</span>
            {schedulePlans.length > 0 ? (
              schedulePlans.slice(0, 5).map((plan) => (
                <div key={plan.id} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: planColorMap[plan.id] || '#6b7280' }}
                  ></div>
                  <span className="text-xs truncate max-w-20">{plan.name}</span>
                </div>
              ))
            ) : (
              <>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-xs">已安排</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-xs">进行中</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="text-xs">已完成</span>
          </div>
              </>
            )}
            {schedulePlans.length > 5 && (
              <span className="text-xs text-muted-foreground">等{schedulePlans.length}个计划</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">加载日历中...</p>
            </div>
          </div>
        ) : (
          <div className="calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={currentView}
              headerToolbar={false} // 禁用默认头部，使用自定义头部
              events={events}
              eventClick={readonly ? undefined : handleEventClick} // 只读模式下禁用事件点击
              dateClick={readonly ? undefined : handleDateClick} // 只读模式下禁用日期点击
              editable={false} // 禁用编辑功能
              droppable={false} // 禁用拖拽
              selectable={false} // 禁用选择
              dayMaxEvents={true}
              weekends={true}
              locale="zh-cn"
              height="auto"
              eventContent={(eventInfo) => {
                const schedule = eventInfo.event.extendedProps.schedule;
                const isTimeGridView = currentView.includes('timeGrid');
                
                return (
                  <div className="p-1 overflow-hidden">
                    <div className="text-xs font-medium truncate">
                      {eventInfo.event.title}
                    </div>
                    {isTimeGridView && (
                      <>
                        <div className="text-xs opacity-90 truncate">
                          {eventInfo.event.extendedProps.className}
                        </div>
                        <div className="text-xs opacity-75 truncate">
                          {eventInfo.event.extendedProps.teacherName}
                        </div>
                      </>
                    )}
                  </div>
                );
              }}
              eventMouseEnter={(info) => {
                // 悬停提示信息
                const props = info.event.extendedProps;
                const participantText = props.participantsCount > 0 
                  ? `${props.className} + ${props.participantsCount}名额外学员`
                  : props.className;
                
                const tooltipLines = [
                  `课程: ${info.event.title}`,
                  `本节课主题: ${props.lessonTitle || '未设置'}`,
                  `所属课表: ${props.planName}`,
                  `学员: ${participantText}`,
                  `任课老师: ${props.teacherName}`,
                  `地点: ${props.venueName}`
                ];
                
                // 只读模式下不显示交互提示
                if (!readonly) {
                  tooltipLines.push('', '点击查看详情');
                }
                
                info.el.title = tooltipLines.join('\n');
              }}
            />
          </div>
        )}
      </CardContent>

      {/* FullCalendar自定义样式 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .calendar-container .fc {
            font-family: inherit;
            font-size: 14px;
          }
          
          .calendar-container .fc-theme-standard .fc-scrollgrid {
            border: 1px solid #e5e7eb;
          }
          
          .calendar-container .fc-theme-standard .fc-scrollgrid td,
          .calendar-container .fc-theme-standard .fc-scrollgrid th {
            border-color: #e5e7eb;
          }
          
          .calendar-container .fc-col-header-cell {
            background-color: #f9fafb;
            padding: 8px;
            font-weight: 600;
            color: #374151;
          }
          
          .calendar-container .fc-daygrid-day {
            background-color: #ffffff;
          }
          
          .calendar-container .fc-day-today {
            background-color: #fef3c7 !important;
          }
          
          .calendar-container .fc-daygrid-event {
            border-radius: 4px;
            border: none;
            font-size: 12px;
            cursor: pointer;
            margin: 1px;
            padding: 2px 4px;
          }
          
          .calendar-container .fc-daygrid-event:hover {
            opacity: 0.9;
          }
          
          .calendar-container .fc-timegrid-event {
            border-radius: 4px;
            border: none;
            font-size: 12px;
            cursor: pointer;
          }
          
          .calendar-container .fc-timegrid-event:hover {
            opacity: 0.9;
          }
          
          .calendar-container .fc-event-title {
            color: white;
            font-weight: 500;
          }
          
          .calendar-container .fc-daygrid-day-number {
            color: #374151;
            font-weight: 500;
            padding: 4px;
          }
          
          .calendar-container .fc-timegrid-slot-label {
            color: #6b7280;
            font-size: 12px;
          }
          
          .calendar-container .fc-timegrid-axis {
            border-color: #e5e7eb;
          }
          
          .calendar-container .fc-timegrid-divider {
            border-color: #e5e7eb;
          }
          
          .calendar-container .fc-more-link {
            color: #3b82f6;
            font-size: 11px;
          }
        `
      }} />
    </Card>
  );
};

export default ScheduleCalendar; 