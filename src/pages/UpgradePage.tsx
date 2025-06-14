import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, Sparkles, Gift, Star } from "lucide-react";
import KeyActivation from "@/components/KeyActivation";

interface UpgradePageProps {
  onActivationSuccess?: () => void;
}

const UpgradePage = ({ onActivationSuccess }: UpgradePageProps) => {
  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUp className="h-6 w-6 text-blue-600" />
          升级学员
        </h1>
        <p className="text-muted-foreground mt-1">
          使用激活密钥升级您的账户权限
        </p>
      </div>

      <div className="w-full space-y-6">
        {/* 密钥激活卡片 */}
        <KeyActivation onActivationSuccess={onActivationSuccess} />

        {/* 升级说明卡片 */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Star className="h-5 w-5" />
              升级权益说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* 体验用户权益 */}
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  体验用户权益
                </h3>
                <ul className="space-y-2 text-sm text-orange-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    有效期：1个月
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    可访问部分课程内容
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    基础学习功能
                  </li>
                </ul>
              </div>

              {/* 正式学员权益 */}
              <div className="bg-white/60 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  正式学员权益
                </h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    有效期：3年
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    完整课程内容访问
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    全部学习功能
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    专属学习资料
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-blue-900 mb-2">💡 温馨提示</h4>
              <p className="text-sm text-blue-800">
                激活密钥后，您的账户权限将立即升级，有效期也会相应延长。如果您没有激活密钥，请联系老师或管理员获取。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpgradePage; 