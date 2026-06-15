import { Link } from 'react-router-dom';

export default function AdminStudyPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
          内容治理
        </h1>
        <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
          这里承载学习内容区段、审核队列和版本治理。完整治理界面由内容治理子任务接入。
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/study/reviews"
          className="inline-flex items-center text-[13px] font-medium bg-oxblood text-white px-4 py-2 rounded-md hover:bg-oxblood-ink transition-ui"
        >
          查看审核队列
        </Link>
        <Link
          to="/app/study"
          className="inline-flex items-center text-[13px] font-medium border border-ink text-ink px-4 py-2 rounded-md hover:bg-panel transition-ui"
        >
          查看用户学习页
        </Link>
      </div>
    </div>
  );
}
