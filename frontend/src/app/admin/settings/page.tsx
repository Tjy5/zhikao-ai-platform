export default function AdminSettingsPage() {
  return (
    <section>
      <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
        系统设置
      </h1>
      <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
        这里会接入全局写作 AI 默认配置、注册开关、内容提案开关和审核策略。完整功能由系统设置子任务实现。
      </p>
    </section>
  );
}
