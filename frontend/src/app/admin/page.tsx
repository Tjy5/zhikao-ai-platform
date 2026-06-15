import { Link } from 'react-router-dom';

const ADMIN_AREAS = [
  {
    to: '/admin/study',
    title: '内容治理',
    desc: '管理申论学习内容、审核提案、查看版本历史。',
  },
  {
    to: '/admin/users',
    title: '用户管理',
    desc: '查看用户、调整角色、管理账号启停。',
  },
  {
    to: '/admin/settings',
    title: '系统设置',
    desc: '维护全局 AI 默认配置和平台运营策略。',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[28px] md:text-[32px] font-semibold text-ink leading-tight">
          管理概览
        </h1>
        <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
          管理端用于内容治理、用户管理与系统策略配置。当前壳层已就绪，业务页面由对应子任务接入。
        </p>
      </section>

      <section className="grid gap-px rounded-lg border border-line bg-line overflow-hidden md:grid-cols-3">
        {ADMIN_AREAS.map((area) => (
          <Link
            key={area.to}
            to={area.to}
            className="bg-paper p-5 hover:bg-panel transition-ui"
          >
            <h2 className="text-[15px] font-semibold text-ink">
              {area.title}
            </h2>
            <p className="mt-2 text-[13px] text-mute leading-relaxed">
              {area.desc}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
