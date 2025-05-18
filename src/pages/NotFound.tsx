
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">页面未找到</h2>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        您请求的页面不存在或已被移动到其他位置。
      </p>
      <Button asChild>
        <Link to="/auth/login">返回登录页</Link>
      </Button>
    </div>
  );
};

export default NotFound;
