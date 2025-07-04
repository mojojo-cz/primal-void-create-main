import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  autoFullscreen?: boolean;
  className?: string;
  startTime?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  autoPlay = false,
  autoFullscreen = false,
  className = '',
  startTime = 0,
  onPlay,
  onPause,
  onEnded,
  onLoadStart,
  onCanPlay
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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

    console.log('[VideoPlayer] enterFullscreen 开始', { videoElement, containerElement });

    try {
      // 移动端优先尝试视频元素的webkitEnterFullscreen（iOS Safari特有）
      if (videoElement && typeof (videoElement as any).webkitEnterFullscreen === 'function') {
        console.log('[VideoPlayer] 使用 webkitEnterFullscreen (iOS)');
        (videoElement as any).webkitEnterFullscreen();
        return;
      }

      // 屏幕方向锁定（如果支持）
      if (videoElement) {
        if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
            try {
              const targetOrientation = videoElement.videoWidth > videoElement.videoHeight ? 'landscape' : 'portrait';
              console.log('[VideoPlayer] 尝试锁定屏幕方向:', targetOrientation);
              await (screen.orientation as any).lock(targetOrientation);
            } catch (orientError: any) {
              console.warn(`[VideoPlayer] Screen orientation lock failed: ${orientError.message || orientError}`);
            }
          }
        }
      }
      
      // 优先尝试视频元素全屏
      if (videoElement) {
        if (videoElement.requestFullscreen) {
          console.log('[VideoPlayer] 使用 video.requestFullscreen');
          await videoElement.requestFullscreen();
          return;
        } else if ((videoElement as any).webkitRequestFullscreen) {
          console.log('[VideoPlayer] 使用 video.webkitRequestFullscreen');
          await (videoElement as any).webkitRequestFullscreen();
          return;
        } else if ((videoElement as any).mozRequestFullScreen) {
          console.log('[VideoPlayer] 使用 video.mozRequestFullScreen');
          await (videoElement as any).mozRequestFullScreen();
          return;
        } else if ((videoElement as any).msRequestFullscreen) {
          console.log('[VideoPlayer] 使用 video.msRequestFullscreen');
          await (videoElement as any).msRequestFullscreen();
          return;
        }
      }

      // 备用：容器元素全屏
      if (containerElement) {
        console.log('[VideoPlayer] 回退到容器元素全屏');
        if (containerElement.requestFullscreen) {
          console.log('[VideoPlayer] 使用 container.requestFullscreen');
          await containerElement.requestFullscreen();
        } else if ((containerElement as any).webkitRequestFullscreen) {
          console.log('[VideoPlayer] 使用 container.webkitRequestFullscreen');
          await (containerElement as any).webkitRequestFullscreen();
        } else if ((containerElement as any).mozRequestFullScreen) {
          console.log('[VideoPlayer] 使用 container.mozRequestFullScreen');
          await (containerElement as any).mozRequestFullScreen();
        } else if ((containerElement as any).msRequestFullscreen) {
          console.log('[VideoPlayer] 使用 container.msRequestFullscreen');
          await (containerElement as any).msRequestFullscreen();
        } else {
          throw new Error('浏览器不支持全屏功能');
        }
      } else {
        throw new Error('无法找到可全屏的元素');
      }
    } catch (error: any) {
      console.error(`[VideoPlayer] Error entering fullscreen: ${error.message || error}`);
      throw error;
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
  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[VideoPlayer] 全屏按钮点击', { isFullscreen, videoRef: videoRef.current, containerRef: containerRef.current });
    
    try {
      if (isFullscreen) {
        console.log('[VideoPlayer] 尝试退出全屏');
        await exitFullscreen();
      } else {
        console.log('[VideoPlayer] 尝试进入全屏');
        await enterFullscreen();
      }
    } catch (error) {
      console.error('[VideoPlayer] 全屏切换失败:', error);
      // 显示错误提示
      const errorMessage = isFullscreen ? '退出全屏失败' : '进入全屏失败';
      alert(`${errorMessage}: ${error}`);
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

  // 处理视频开始加载事件
  const handleLoadStart = () => {
    setIsLoading(true);
    onLoadStart?.();
  };

  // 处理视频可以播放事件
  const handleCanPlay = () => {
    setIsLoading(false);
    onCanPlay?.();
  };

  // 当src变化时，更新加载状态
  useEffect(() => {
    if (!src) {
      setIsLoading(true);
    }
  }, [src]);

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

  // 设置视频起始播放位置
  useEffect(() => {
    const video = videoRef.current;
    if (video && startTime > 0) {
      const setVideoTime = () => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          video.currentTime = startTime;
          video.removeEventListener('loadedmetadata', setVideoTime);
        }
      };

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.currentTime = startTime;
      } else {
        video.addEventListener('loadedmetadata', setVideoTime);
      }

      return () => {
        video.removeEventListener('loadedmetadata', setVideoTime);
      };
    }
  }, [startTime, src]);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isFullscreen && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src || undefined}
        controls
        autoPlay={autoPlay && !!src}
        playsInline
        preload="metadata"
        className="w-full h-full"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onLoadedData={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
      />
      
      {/* 加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-black/70 rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
            <span className="text-white text-sm">加载中...</span>
          </div>
        </div>
      )}
      
      {/* 考点标题 */}
      {title && (
        <div 
          className={`absolute top-3 left-3 transition-all duration-300 z-40 max-w-[calc(100%-6rem)] ${
            isFullscreen ? (showControls ? 'opacity-70' : 'opacity-0') : 'opacity-70'
          }`}
          style={{
            top: isFullscreen ? 'max(0.75rem, env(safe-area-inset-top))' : '0.75rem',
            left: isFullscreen ? 'max(0.75rem, env(safe-area-inset-left))' : '0.75rem'
          }}
        >
          <div className="bg-black/40 text-white/80 px-2 py-1 rounded text-xs backdrop-blur-sm truncate">
            {title}
          </div>
        </div>
      )}
      
      {/* 全屏按钮 */}
      <div 
        className={`absolute top-3 right-3 transition-all duration-300 z-50 ${
          isFullscreen ? (showControls ? 'opacity-70' : 'opacity-0') : 'opacity-70'
        }`}
        style={{ 
          pointerEvents: 'auto',
          top: isFullscreen ? 'max(0.75rem, env(safe-area-inset-top))' : '0.75rem',
          right: isFullscreen ? 'max(0.75rem, env(safe-area-inset-right))' : '0.75rem'
        }}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleFullscreen}
          className="bg-black/40 text-white/80 border-0 backdrop-blur-sm w-8 h-8 p-0 touch-manipulation rounded-full"
          title={isFullscreen ? '退出全屏' : '进入全屏'}
          style={{ 
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            pointerEvents: 'auto',
            zIndex: 9999
          }}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
      </div>


    </div>
  );
};

export default VideoPlayer; 