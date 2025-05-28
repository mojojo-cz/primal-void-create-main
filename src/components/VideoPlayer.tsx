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

      if (!isCurrentlyFullscreen && screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
        (screen.orientation as any).unlock();
      }
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
    const videoElement = videoRef.current;
    const containerElement = containerRef.current;

    try {
      if (videoElement) {
        if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
            try {
              const targetOrientation = videoElement.videoWidth > videoElement.videoHeight ? 'landscape' : 'portrait';
              await (screen.orientation as any).lock(targetOrientation);
            } catch (orientError: any) {
              console.warn(`[VideoPlayer] Screen orientation lock failed: ${orientError.message || orientError}`);
            }
          }
        }
      }
      
      if (videoElement && typeof (videoElement as any).webkitEnterFullscreen === 'function') {
        (videoElement as any).webkitEnterFullscreen();
        return;
      }
      
      if (videoElement && videoElement.requestFullscreen) {
        await videoElement.requestFullscreen();
        return;
      } else if (videoElement && (videoElement as any).webkitRequestFullscreen) {
        await (videoElement as any).webkitRequestFullscreen();
        return;
      } else if (videoElement && (videoElement as any).mozRequestFullScreen) {
        await (videoElement as any).mozRequestFullScreen();
        return;
      } else if (videoElement && (videoElement as any).msRequestFullscreen) {
        await (videoElement as any).msRequestFullscreen();
        return;
      }

      if (containerElement) {
        if (containerElement.requestFullscreen) {
          await containerElement.requestFullscreen();
        } else if ((containerElement as any).webkitRequestFullscreen) {
          await (containerElement as any).webkitRequestFullscreen();
        } else if ((containerElement as any).mozRequestFullScreen) {
          await (containerElement as any).mozRequestFullScreen();
        } else if ((containerElement as any).msRequestFullscreen) {
          await (containerElement as any).msRequestFullscreen();
        }
      }
    } catch (error: any) {
      console.error(`[VideoPlayer] Error entering fullscreen: ${error.message || error}`);
    }
  };

  // 退出全屏
  const exitFullscreen = async () => {
    try {
      let exited = false;
      if (document.exitFullscreen) {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          exited = true;
        }
      } else if ((document as any).webkitExitFullscreen) {
        if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
          exited = true;
        }
      } else if ((document as any).mozCancelFullScreen) {
        if ((document as any).mozFullScreenElement) {
          await (document as any).mozCancelFullScreen();
          exited = true;
        }
      } else if ((document as any).msExitFullscreen) {
        if ((document as any).msFullscreenElement) {
          await (document as any).msExitFullscreen();
          exited = true;
        }
      }
      if (!exited) {
        if (document.exitFullscreen) await document.exitFullscreen().catch(e => console.warn("Error attempting to force exit fullscreen:", e));
        else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen().catch(e => console.warn("Error attempting to force exit webkit fullscreen:", e));
        else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen().catch(e => console.warn("Error attempting to force exit moz fullscreen:", e));
        else if ((document as any).msExitFullscreen) await (document as any).msExitFullscreen().catch(e => console.warn("Error attempting to force exit ms fullscreen:", e));
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
      // 移除 setTimeout 延迟
      enterFullscreen();
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
        playsInline
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