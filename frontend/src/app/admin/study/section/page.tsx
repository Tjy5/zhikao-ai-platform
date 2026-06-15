import { useParams } from 'react-router-dom';

export default function AdminStudySectionPage() {
  const { key } = useParams<{ key: string }>();

  return (
    <section>
      <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
        区段治理
      </h1>
      <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
        当前区段：<span className="font-mono text-ink">{key || '未指定'}</span>。
        编辑、版本历史和恢复流程由内容治理子任务接入。
      </p>
    </section>
  );
}
