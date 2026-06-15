export default function AdminStudyReviewsPage() {
  return (
    <section>
      <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
        审核队列
      </h1>
      <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
        待审核的学习内容提案会在这里集中处理。完整队列、通过和驳回流程由内容治理子任务接入。
      </p>
    </section>
  );
}
