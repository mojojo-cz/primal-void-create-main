import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSystemSettings } from './utils/systemSettings'

// 初始化系统设置
initSystemSettings();

createRoot(document.getElementById("root")!).render(<App />);
