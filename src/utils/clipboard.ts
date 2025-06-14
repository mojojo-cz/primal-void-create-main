import { toast } from "@/hooks/use-toast";

// 设备检测函数
export const isIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent);
export const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent);
export const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 兼容性复制函数
const fallbackCopyTextToClipboard = (text: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // 防止页面滚动
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      resolve(successful);
    } catch (err) {
      document.body.removeChild(textArea);
      resolve(false);
    }
  });
};

// 主复制函数
export const copyToClipboard = async (text: string, options?: {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
}): Promise<boolean> => {
  const {
    successTitle = "复制成功",
    successDescription = "内容已复制到剪贴板",
    errorTitle = "复制失败",
    errorDescription = "无法复制到剪贴板，请手动复制"
  } = options || {};

  try {
    // 优先使用现代剪贴板API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      toast({
        title: successTitle,
        description: successDescription
      });
      return true;
    } else {
      // 回退到传统方法
      const success = await fallbackCopyTextToClipboard(text);
      if (success) {
        toast({
          title: successTitle,
          description: successDescription
        });
        return true;
      } else {
        throw new Error('fallback failed');
      }
    }
  } catch (error) {
    console.error('复制失败:', error);
    
    // 移动端友好提示
    if (isIOS() || isWeChat() || isMobile()) {
      toast({
        title: "请手动复制",
        description: "长按内容进行复制",
        duration: 3000
      });
    } else {
      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorDescription
      });
    }
    return false;
  }
};

// 专门用于密钥复制的函数
export const copyKeyToClipboard = async (key: string): Promise<boolean> => {
  return copyToClipboard(key, {
    successTitle: "复制成功",
    successDescription: "密钥已复制到剪贴板",
    errorTitle: "复制失败",
    errorDescription: "无法复制到剪贴板，请手动复制"
  });
}; 