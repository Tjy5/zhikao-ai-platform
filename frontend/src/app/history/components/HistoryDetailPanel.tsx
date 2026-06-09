import { Clipboard, Code2, Database, FileJson, FileText } from 'lucide-react';

import MarkdownContent from '../../../components/MarkdownContent';
import type { HistoryDetail } from '../types';
import {
  formatHistoryRichText,
  jsonSanitizer,
  niceDate,
  normalizeDetails,
} from '../utils';

interface HistoryDetailPanelProps {
  selected: HistoryDetail | null;
  showRaw: boolean;
  onToggleRaw: () => void;
  onCopy: (object: unknown) => void;
}

export default function HistoryDetailPanel({
  selected,
  showRaw,
  onToggleRaw,
  onCopy,
}: HistoryDetailPanelProps) {
  if (!selected) {
    return (
      <section className='history-detail-panel'>
        <div className='flex min-h-[640px] items-center justify-center p-8'>
          <div className='relative text-center'>
            <span
              aria-hidden='true'
              className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[6px] border border-ink-light/15 bg-paper-rice/70 font-kaishu text-lg text-ink'
            >
              待选
            </span>
            <Database
              className='mx-auto mb-5 h-12 w-12 text-ink-wash/35'
              aria-hidden='true'
            />
            <div className='mb-4 font-running-script text-4xl font-normal text-ink-wash'>
              请选择记录查看详情
            </div>
            <div className='font-kaishu text-lg text-ink-wash/70'>
              点击左侧列表中的任意记录
            </div>
            <div className='mt-6 flex justify-center gap-2'>
              {['原文', '原始内容', '历史 JSON'].map(item => (
                <span
                  key={item}
                  className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1 font-kaishu text-xs text-ink'
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className='history-detail-panel overflow-hidden'>
      <div className='history-detail-heading p-5 sm:p-6 lg:p-8'>
        <div className='mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between'>
          <h2 className='flex items-center font-running-script text-4xl font-normal text-ink'>
            <span className='mr-3 flex h-10 w-10 items-center justify-center rounded-[4px] border border-ink-light/15 bg-paper/70 text-ink shadow-sm'>
              <FileJson className='h-5 w-5' aria-hidden='true' />
            </span>
            详情信息
          </h2>
          <div className='flex flex-wrap gap-2'>
            <span aria-hidden='true' className='seal-mark text-xl'>
              已选
            </span>
            <span className='rounded-[4px] border border-ink-light/15 bg-paper/80 px-3 py-1 font-kaishu text-xs text-ink'>
              记录详情
            </span>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-4'>
          <span className='max-w-full min-w-0 break-all rounded-[4px] border border-ink-light/15 bg-paper/65 px-3 py-2 font-mono text-sm text-ink-wash'>
            ID: {selected.id.substring(0, 20)}...
          </span>
          <button
            className='ink-hover history-tool-button inline-flex items-center gap-2 rounded-[4px] px-4 py-2 font-kaishu text-sm text-ink transition-all hover:-translate-y-0.5'
            onClick={onToggleRaw}
            type='button'
          >
            <Code2 className='h-4 w-4' aria-hidden='true' />
            {showRaw ? '结构化视图' : '原始JSON'}
          </button>
          <button
            className='ink-hover history-tool-button inline-flex items-center gap-2 rounded-[4px] px-4 py-2 font-kaishu text-sm text-ink transition-all hover:-translate-y-0.5'
            onClick={() => onCopy(selected.response ?? selected)}
            type='button'
          >
            <Clipboard className='h-4 w-4' aria-hidden='true' />
            复制数据
          </button>
        </div>
      </div>

      <div className='max-h-[820px] overflow-y-auto p-5 sm:p-6 lg:p-8'>
        {showRaw ? (
          <RawDetail selected={selected} />
        ) : (
          <StructuredDetail selected={selected} />
        )}
      </div>
    </section>
  );
}

function RawDetail({ selected }: { selected: HistoryDetail }) {
  return (
    <div className='space-y-6'>
      <RawBlock title='请求数据' value={selected.request} />
      <RawBlock title='响应数据' value={selected.response} />
      {selected.extra && <RawBlock title='额外信息' value={selected.extra} />}
    </div>
  );
}

function RawBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className='mb-4 font-semi-cursive text-2xl text-ink'>{title}</div>
      <pre className='max-h-64 overflow-auto rounded-[6px] border border-ink-light/15 bg-ink-dark/95 p-4 font-mono text-sm leading-relaxed text-paper-rice shadow-inner'>
        {JSON.stringify(value, jsonSanitizer, 2)}
      </pre>
    </div>
  );
}

function StructuredDetail({ selected }: { selected: HistoryDetail }) {
  const rawContent = typeof selected.response?.content === 'string'
    ? selected.response.content.trim()
    : '';
  const hasStructuredFields = Boolean(
    typeof selected.response?.score === 'number' ||
      selected.response?.feedback ||
      selected.response?.suggestions ||
      selected.response?.scoreDetails
  );

  if (!hasStructuredFields) {
    return <RawMarkdownDetail selected={selected} rawContent={rawContent} />;
  }

  const scoreDetails = normalizeDetails(selected.response?.scoreDetails);
  const totalFullScore =
    scoreDetails?.reduce((sum, detail) => sum + (detail.fullScore || 0), 0) ??
    0;
  const displayScale =
    totalFullScore > 0 && Math.abs(totalFullScore - 100) > 0.1
      ? 100 / totalFullScore
      : 1;
  const taskType = String(
    selected.response?.taskType ??
      selected.request?.task_type ??
      '未识别'
  );
  const score = selected.response?.score;

  return (
    <div className='space-y-8'>
      <div className='history-section-card notebook-lines p-6'>
        <div className='mb-5 flex items-center'>
          <span className='font-running-script text-3xl font-normal text-ink'>
            基本信息
          </span>
        </div>
        <div className='space-y-4'>
          <InfoRow label='提交时间' value={niceDate(selected.timestamp)} />
          <InfoRow label='类型' value={selected.type || ''} />
          <InfoRow label='任务类型' value={taskType} />
          {typeof score === 'number' && (
            <InfoRow label='总分' value={`${Number(score).toFixed(1)} 分`} />
          )}
        </div>
      </div>

      {scoreDetails && scoreDetails.length > 0 && (
        <div className='history-section-card overflow-hidden'>
          <div className='border-b border-ink-light/10 p-6'>
            <h3 className='font-running-script text-3xl font-normal text-ink'>
              评分明细
            </h3>
          </div>
          <div className='space-y-5 p-6'>
            {scoreDetails.map((detail, index) => {
              const full = (detail.fullScore || 0) * displayScale;
              const percentage =
                full > 0
                  ? Math.max(
                      0,
                      Math.min(100, (detail.actualScore / full) * 100)
                    )
                  : 0;
              return (
                <div
                  key={`${detail.item}-${index}`}
                  className='score-detail-card rounded-[6px] border border-ink-light/10 bg-paper/55 p-5 shadow-sm'
                >
                  <div className='mb-3 flex items-center justify-between'>
                    <span className='font-kaishu text-base text-ink'>
                      {detail.item}
                    </span>
                    <span className='font-running-script text-2xl text-seal-red'>
                      {detail.actualScore}/{Number(full.toFixed(1))}
                    </span>
                  </div>
                  <div className='mb-4 h-3 w-full rounded-[3px] bg-paper-rice/80'>
                    <div
                      className='h-3 rounded-[3px] bg-seal-red shadow-sm transition-all duration-500'
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div
                    className='text-sm leading-relaxed text-ink'
                    dangerouslySetInnerHTML={{
                      __html: formatHistoryRichText(detail.description),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {typeof selected.response?.feedback === 'string' && (
        <RichSection title='详细反馈' value={selected.response.feedback} />
      )}

      {Array.isArray(selected.response?.suggestions) &&
        selected.response.suggestions.length > 0 && (
          <div className='history-section-card overflow-hidden'>
            <div className='border-b border-ink-light/10 p-6'>
              <h3 className='font-running-script text-3xl font-normal text-ink'>
                改进建议
              </h3>
            </div>
            <div className='p-6'>
              <ul className='space-y-5'>
                {(selected.response.suggestions as string[]).map(
                  (suggestion, index) => (
                    <li key={index} className='flex items-start'>
                      <div className='mr-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border border-seal-red/25 bg-peach-soft/70 shadow-sm'>
                        <span className='text-sm font-bold text-seal-red'>
                          {index + 1}
                        </span>
                      </div>
                      <div
                        className='text-base leading-relaxed text-ink'
                        dangerouslySetInnerHTML={{
                          __html: formatHistoryRichText(suggestion, 'mb-3'),
                        }}
                      />
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        )}

      {rawContent && (
        <div className='history-section-card overflow-hidden'>
          <div className='border-b border-ink-light/10 p-6'>
            <h3 className='flex items-center font-running-script text-3xl font-normal text-ink'>
              <FileText className='mr-3 h-5 w-5' aria-hidden='true' />
              原始 Markdown
            </h3>
          </div>
          <div className='p-6'>
            <MarkdownContent content={rawContent} className='text-ink' />
          </div>
        </div>
      )}
    </div>
  );
}

function RawMarkdownDetail({
  selected,
  rawContent,
}: {
  selected: HistoryDetail;
  rawContent: string;
}) {
  const contentFormat =
    typeof selected.response?.contentFormat === 'string'
      ? selected.response.contentFormat
      : 'markdown';
  const requestTaskType =
    typeof selected.request?.task_type === 'string'
      ? selected.request.task_type.trim()
      : '';
  const responseTaskType =
    typeof selected.response?.taskType === 'string'
      ? selected.response.taskType.trim()
      : '';
  const taskType =
    requestTaskType || responseTaskType || '由模型判断';

  return (
    <div className='space-y-8'>
      <div className='history-section-card notebook-lines p-6'>
        <div className='mb-5 flex items-center'>
          <span className='font-running-script text-3xl font-normal text-ink'>
            基本信息
          </span>
        </div>
        <div className='space-y-4'>
          <InfoRow label='提交时间' value={niceDate(selected.timestamp)} />
          <InfoRow label='类型' value={selected.type || ''} />
          <InfoRow label='任务类型' value={taskType} />
          <InfoRow label='内容格式' value={contentFormat} />
        </div>
      </div>

      <div className='history-section-card overflow-hidden'>
        <div className='border-b border-ink-light/10 p-6'>
          <h3 className='flex items-center font-running-script text-3xl font-normal text-ink'>
            <FileText className='mr-3 h-5 w-5' aria-hidden='true' />
            AI 原始批改结果
          </h3>
        </div>
        <div className='p-6'>
          {rawContent ? (
            <MarkdownContent content={rawContent} className='text-ink' />
          ) : (
            <div className='rounded-[6px] border border-dashed border-ink-light/20 bg-paper/60 p-6 font-kaishu text-base text-ink-wash'>
              该记录未返回原始 Markdown 内容。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
      <span className='font-kaishu text-sm text-ink-wash'>{label}</span>
      <span className='break-all font-kaishu text-sm text-ink sm:text-right'>
        {value}
      </span>
    </div>
  );
}

function RichSection({ title, value }: { title: string; value: string }) {
  return (
    <div className='history-section-card notebook-lines overflow-hidden'>
      <div className='border-b border-ink-light/10 p-6'>
        <h3 className='font-running-script text-3xl font-normal text-ink'>
          {title}
        </h3>
      </div>
      <div className='p-6'>
        <div
          className='text-base leading-loose text-ink'
          dangerouslySetInnerHTML={{
            __html: formatHistoryRichText(
              value,
              'mb-4',
              'text-seal-red font-semibold'
            ),
          }}
        />
      </div>
    </div>
  );
}
