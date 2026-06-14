import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import writingService from '../services/writingService';
import { Button } from '../components/ui/Button';

interface UserStats {
  totalCount: number;
  thisWeekCount: number;
  lastGradingTime: string | null;
  isPartialCount: boolean; // Flag to indicate if totalCount is partial (capped by backend limit)
}

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }

    // Fetch user stats asynchronously
    let isMounted = true;

    void (async () => {
      setStatsLoading(true);

      try {
        const response = await writingService.getHistory();
        if (!isMounted) return;

        // Calculate stats from history
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const thisWeekCount = response.items.filter((item) => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= weekAgo;
        }).length;

        const sortedItems = [...response.items].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Backend returns max 50 items by default (or up to 200 if requested)
        // Since we're not passing a limit, we get the default 50
        // Mark as partial if we got exactly 50 (likely more exist)
        const isPartialCount = response.items.length >= 50;

        setStats({
          totalCount: response.items.length,
          thisWeekCount,
          lastGradingTime: sortedItems.length > 0 ? sortedItems[0].timestamp : null,
          isPartialCount,
        });
      } catch {
        if (!isMounted) return;
        setStats({ totalCount: 0, thisWeekCount: 0, lastGradingTime: null, isPartialCount: false });
      }

      if (isMounted) {
        setStatsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authLoading]);

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <main id="main-content" className="min-h-screen bg-paper-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-card-cream to-paper-white border-b border-slate-gray/10">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-deep-ink mb-6">
              墨评AI
            </h1>
            <p className="text-xl sm:text-2xl text-slate-gray mb-8 leading-relaxed">
              专业的AI写作批改工具
              <br />
              <span className="text-lg">精准分析 · 深度反馈 · 持续进步</span>
            </p>

            {authLoading ? (
              <div className="inline-block px-8 py-4">
                <div className="w-6 h-6 border-2 border-vermilion border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/app/writing">
                  <Button size="lg" className="min-w-[200px]">
                    开始批改
                  </Button>
                </Link>
                <Link to="/app/history">
                  <Button variant="outline" size="lg" className="min-w-[200px]">
                    查看历史
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/register">
                  <Button size="lg" className="min-w-[200px]">
                    立即注册
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="min-w-[200px]">
                    登录
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section - Only for logged-in users */}
      {isAuthenticated && !authLoading && (
        <section className="border-b border-slate-gray/10">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-display font-semibold text-deep-ink mb-8 text-center">
              您的学习数据
            </h2>

            {statsLoading ? (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-vermilion border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card-cream rounded-lg p-6 text-center border border-slate-gray/10">
                  <div className="text-4xl font-bold text-vermilion mb-2">
                    {stats?.totalCount ?? 0}
                  </div>
                  <div className="text-slate-gray">
                    {stats?.isPartialCount ? '最近记录数' : '历史批改次数'}
                  </div>
                  {stats?.isPartialCount && (
                    <div className="text-xs text-slate-gray/70 mt-1">
                      （显示最近50条）
                    </div>
                  )}
                </div>

                <div className="bg-card-cream rounded-lg p-6 text-center border border-slate-gray/10">
                  <div className="text-4xl font-bold text-vermilion mb-2">
                    {stats?.thisWeekCount ?? 0}
                  </div>
                  <div className="text-slate-gray">本周练习次数</div>
                </div>

                <div className="bg-card-cream rounded-lg p-6 text-center border border-slate-gray/10">
                  <div className="text-lg font-semibold text-deep-ink mb-2">
                    {stats?.lastGradingTime ? formatRelativeTime(stats.lastGradingTime) : '暂无记录'}
                  </div>
                  <div className="text-slate-gray">上次批改时间</div>
                </div>
              </div>
            )}

            {user && (
              <div className="mt-6 text-center text-slate-gray">
                欢迎回来，<span className="text-deep-ink font-semibold">{user.username}</span>！
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-display font-semibold text-deep-ink mb-12 text-center">
            核心功能
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1: AI Grading */}
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-vermilion/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-vermilion" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-ink mb-2">AI智能批改</h3>
              <p className="text-slate-gray text-sm leading-relaxed">
                基于先进的AI模型，提供专业、详细的写作批改反馈，涵盖内容、结构、语言等多个维度
              </p>
            </div>

            {/* Feature 2: Real-time Progress */}
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-vermilion/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-vermilion" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-ink mb-2">实时批改进度</h3>
              <p className="text-slate-gray text-sm leading-relaxed">
                渐进式批改流程，实时显示分析和评分进度，让您清晰了解批改状态
              </p>
            </div>

            {/* Feature 3: History Management */}
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-vermilion/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-vermilion" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-ink mb-2">历史记录管理</h3>
              <p className="text-slate-gray text-sm leading-relaxed">
                完整保存批改历史，支持时间筛选和内容搜索，方便回顾学习进步轨迹
              </p>
            </div>

            {/* Feature 4: Flexible Configuration */}
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/10 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-vermilion/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-vermilion" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-deep-ink mb-2">灵活配置</h3>
              <p className="text-slate-gray text-sm leading-relaxed">
                支持自定义AI模型和配置，一键测试连接，智能发现可用模型，满足个性化需求
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Only for non-logged-in users */}
      {!isAuthenticated && !authLoading && (
        <section className="bg-gradient-to-br from-card-cream to-paper-white border-t border-slate-gray/10">
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <h2 className="text-3xl font-display font-semibold text-deep-ink mb-4">
              开始您的写作进步之旅
            </h2>
            <p className="text-lg text-slate-gray mb-8">
              立即注册，体验专业的AI写作批改服务
            </p>
            <Link to="/register">
              <Button size="lg" className="min-w-[200px]">
                免费注册
              </Button>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
