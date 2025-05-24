import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  autoFullscreen?: boolean;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  autoPlay = false,
  autoFullscreen = false,
  className = '',
  onPlay,
  onPause,
  onEnded
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // 检测全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 进入全屏
  const enterFullscreen = async () => {
    const element = containerRef.current;
    if (!element) return;

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('进入全屏失败:', error);
    }
  };

  // 退出全屏
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen && (document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen && (document as any).mozFullScreenElement) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen && (document as any).msFullscreenElement) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('退出全屏失败:', error);
    }
  };

  // 切换全屏
  const toggleFullscreen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // 处理视频播放事件
  const handlePlay = () => {
    onPlay?.();
    
    // 如果设置了自动全屏，则在播放时进入全屏
    if (autoFullscreen && !isFullscreen) {
      setTimeout(() => {
        enterFullscreen();
      }, 100); // 稍微延迟以确保播放已开始
    }
  };

  // 处理视频暂停事件
  const handlePause = () => {
    onPause?.();
  };

  // 处理视频结束事件
  const handleEnded = () => {
    onEnded?.();
  };

  // 鼠标移动时显示控制条
  const handleMouseMove = () => {
    setShowControls(true);
  };

  // 隐藏控制条的定时器
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls && isFullscreen) {
      timer = setTimeout(() => {
        setShowControls(false);
      }, 3000); // 3秒后隐藏控制条
    }
    return () => clearTimeout(timer);
  }, [showControls, isFullscreen]);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isFullscreen && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay={autoPlay}
        className="w-full h-full"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        title={title}
      />
      
      {/* 全屏按钮 */}
      <div 
        className={`absolute top-4 right-4 transition-opacity duration-300 ${
          isFullscreen ? (showControls ? 'opacity-100' : 'opacity-0') : 'opacity-100'
        }`}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={toggleFullscreen}
          className="bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm"
          title={isFullscreen ? '退出全屏' : '进入全屏'}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 全屏模式下的标题 */}
      {isFullscreen && title && (
        <div 
          className={`absolute top-4 left-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="bg-black/50 text-white px-3 py-2 rounded backdrop-blur-sm">
            <h3 className="text-lg font-medium">{title}</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 