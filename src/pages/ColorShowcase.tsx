import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Info, BookOpen, Users, TrendingUp } from "lucide-react";

const ColorShowcase = () => {
  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题区域 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold edu-text-gradient mb-4">
            显然考研 - 教育主题配色方案
          </h1>
          <p className="text-lg text-muted-foreground">
            专为教育行业设计的专业、友好、值得信赖的配色系统
          </p>
        </div>

        {/* 主色调展示 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              主色调系统
            </CardTitle>
            <CardDescription>
              以教育蓝为主色调，体现专业性和信任感
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 主色调 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-primary">教育蓝 (Primary)</h3>
                <div className="space-y-2">
                  <div className="h-16 bg-primary rounded-lg edu-glow-primary"></div>
                  <p className="text-sm text-muted-foreground">#2563EB</p>
                  <Button className="w-full">主要按钮</Button>
                </div>
              </div>

              {/* 辅助色调 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-academic-green-600">学术绿 (Success)</h3>
                <div className="space-y-2">
                  <div className="h-16 bg-success rounded-lg edu-glow-success"></div>
                  <p className="text-sm text-muted-foreground">#16A34A</p>
                  <Button variant="outline" className="w-full border-success text-success hover:bg-success hover:text-success-foreground">
                    成功状态
                  </Button>
                </div>
              </div>

              {/* 强调色调 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-academic-orange-600">学术橙 (Warning)</h3>
                <div className="space-y-2">
                  <div className="h-16 bg-warning rounded-lg"></div>
                  <p className="text-sm text-muted-foreground">#F59E0B</p>
                  <Button variant="outline" className="w-full border-warning text-warning hover:bg-warning hover:text-warning-foreground">
                    警告状态
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 状态展示 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Alert className="border-success bg-success/5">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">学习完成</AlertTitle>
            <AlertDescription>
              恭喜！您已完成本考点的学习任务
            </AlertDescription>
          </Alert>

          <Alert className="border-warning bg-warning/5">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">注意事项</AlertTitle>
            <AlertDescription>
              请在考试前完成所有必修课程
            </AlertDescription>
          </Alert>

          <Alert className="border-info bg-info/5">
            <Info className="h-4 w-4 text-info" />
            <AlertTitle className="text-info">学习提示</AlertTitle>
            <AlertDescription>
              建议每天学习2-3小时以获得最佳效果
            </AlertDescription>
          </Alert>
        </div>

        {/* 组件展示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 学习进度卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                学习进度
              </CardTitle>
              <CardDescription>本月学习统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>高等数学</span>
                  <span className="text-muted-foreground">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>英语阅读</span>
                  <span className="text-muted-foreground">72%</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>政治理论</span>
                  <span className="text-muted-foreground">93%</span>
                </div>
                <Progress value={93} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* 课程统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-success" />
                课程统计
              </CardTitle>
              <CardDescription>学习数据概览</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-2xl font-bold text-primary">24</div>
                  <div className="text-sm text-muted-foreground">已完成课程</div>
                </div>
                <div className="text-center p-4 bg-success/5 rounded-lg">
                  <div className="text-2xl font-bold text-success">156</div>
                  <div className="text-sm text-muted-foreground">学习小时</div>
                </div>
                <div className="text-center p-4 bg-warning/5 rounded-lg">
                  <div className="text-2xl font-bold text-warning">8</div>
                  <div className="text-sm text-muted-foreground">待完成课程</div>
                </div>
                <div className="text-center p-4 bg-info/5 rounded-lg">
                  <div className="text-2xl font-bold text-info">92%</div>
                  <div className="text-sm text-muted-foreground">完成率</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 徽章展示 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>状态徽章</CardTitle>
            <CardDescription>不同类型的学习状态标识</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">必修课程</Badge>
              <Badge variant="secondary">选修课程</Badge>
              <Badge variant="outline">待开始</Badge>
              <Badge className="bg-success text-success-foreground">已完成</Badge>
              <Badge className="bg-warning text-warning-foreground">进行中</Badge>
              <Badge className="bg-info text-info-foreground">重要提醒</Badge>
              <Badge variant="destructive">截止临近</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 渐变效果展示 */}
        <Card>
          <CardHeader>
            <CardTitle>特效展示</CardTitle>
            <CardDescription>教育主题的视觉效果</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-4">
                <div className="h-24 edu-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">主色渐变</span>
                </div>
                <p className="text-sm text-muted-foreground">用于重要按钮和主要操作</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="h-24 edu-gradient-success rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">成功渐变</span>
                </div>
                <p className="text-sm text-muted-foreground">用于完成状态和成功提示</p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="h-24 edu-gradient-warning rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">警告渐变</span>
                </div>
                <p className="text-sm text-muted-foreground">用于提醒和警告信息</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 设计理念 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>设计理念</CardTitle>
            <CardDescription>教育行业配色方案的设计思考</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-primary mb-2">专业性</h4>
                <p className="text-sm text-muted-foreground">
                  使用深蓝色作为主色调，传达专业、权威、值得信赖的品牌形象，符合教育机构的专业定位。
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-success mb-2">友好性</h4>
                <p className="text-sm text-muted-foreground">
                  辅助色采用温暖的绿色和橙色，营造友好、积极的学习氛围，减少学习压力。
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-warning mb-2">可读性</h4>
                <p className="text-sm text-muted-foreground">
                  优化了对比度和颜色饱和度，确保长时间学习使用时眼睛不疲劳，提升用户体验。
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-info mb-2">品牌识别</h4>
                <p className="text-sm text-muted-foreground">
                  建立统一的色彩体系，增强品牌识别度，在教育市场中形成独特的视觉识别。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ColorShowcase; 