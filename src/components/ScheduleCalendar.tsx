import React, { useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, List, Grid3X3, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// 导入CSS样式
import '@fullcalendar/core/main.css';
import '@fullcalendar/daygrid/main.css';
import '@fullcalendar/timegrid/main.css';

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
}

interface ScheduleCalendarProps {
  schedules: ScheduleWithDetails[];
  onEventClick?: (schedule: ScheduleWithDetails) => void;
  onDateClick?: (date: Date) => void;
  onEventDrop?: (info: any) => void;
  loading?: boolean;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules,
  onEventClick,
  onDateClick,
  onEventDrop,
  loading = false
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = React.useState('dayGridMonth');

  // 将排课数据转换为FullCalendar事件格式
  const events = React.useMemo(() => {
    return schedules.map(schedule => {
      const startDateTime = `${schedule.schedule_date}T${schedule.start_time}`;
      const endDateTime = `${schedule.schedule_date}T${schedule.end_time}`;
      
      // 根据状态确定颜色
      const getEventColor = (status: string) => {
        switch (status) {
          case 'scheduled': return '#3b82f6'; // 蓝色
          case 'in_progress': return '#10b981'; // 绿色
          case 'completed': return '#6b7280'; // 灰色
          case 'cancelled': return '#ef4444'; // 红色
          default: return '#3b82f6';
        }
      };

      return {
        id: schedule.id,
        title: schedule.lesson_title,
        start: startDateTime,
        end: endDateTime,
        backgroundColor: getEventColor(schedule.status),
        borderColor: getEventColor(schedule.status),
        extendedProps: {
          schedule: schedule,
          className: schedule.class_name,
          subjectName: schedule.subject_name,
          teacherName: schedule.teacher_full_name || schedule.teacher_name,
          venueName: schedule.venue_name || '在线课程',
          status: schedule.status
        }
      };
    });
  }, [schedules]);

  // 处理事件点击
  const handleEventClick = useCallback((info: any) => {
    if (onEventClick) {
      onEventClick(info.event.extendedProps.schedule);
    }
  }, [onEventClick]);

  // 处理日期点击
  const handleDateClick = useCallback((info: any) => {
    if (onDateClick) {
      onDateClick(new Date(info.date));
    }
  }, [onDateClick]);

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

        {/* 状态图例 */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
          <span className="text-sm font-medium">状态图例：</span>
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
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-xs">已取消</span>
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
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventDrop={handleEventDrop}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
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
                // 可以在这里添加悬停提示
                info.el.title = `${info.event.title}\n班级: ${info.event.extendedProps.className}\n教师: ${info.event.extendedProps.teacherName}\n地点: ${info.event.extendedProps.venueName}`;
              }}
            />
          </div>
        )}
      </CardContent>

      {/* 自定义样式 */}
      <style jsx>{`
        .calendar-container {
          --fc-border-color: #e5e7eb;
          --fc-button-text-color: #374151;
          --fc-button-bg-color: #f9fafb;
          --fc-button-border-color: #d1d5db;
          --fc-button-hover-bg-color: #f3f4f6;
          --fc-button-active-bg-color: #e5e7eb;
          --fc-today-bg-color: #fef3c7;
          --fc-event-text-color: #ffffff;
        }
        
        .calendar-container .fc-event {
          border-radius: 4px;
          border: none;
          font-size: 12px;
          cursor: pointer;
        }
        
        .calendar-container .fc-event:hover {
          opacity: 0.9;
        }
        
        .calendar-container .fc-day-today {
          background-color: var(--fc-today-bg-color) !important;
        }
        
        .calendar-container .fc-col-header-cell {
          background-color: #f9fafb;
          border-color: var(--fc-border-color);
        }
        
        .calendar-container .fc-scrollgrid {
          border-color: var(--fc-border-color);
        }
      `}</style>
    </Card>
  );
};

export default ScheduleCalendar; 