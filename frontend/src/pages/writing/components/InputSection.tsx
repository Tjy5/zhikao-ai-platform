/**
 * 输入区域组件
 * 处理写作材料和答案的输入
 */

import {
  BookOpenCheck,
  FileText,
  History,
  Loader2,
  PenLine,
  Send,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Textarea } from '../../../components/ui/Textarea';

interface InputSectionProps {
  sourceMaterial: string;
  myAnswer: string;
  onSourceMaterialChange: (value: string) => void;
  onMyAnswerChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  progress: number;
  statusText: string;
}

export default function InputSection({
  sourceMaterial,
  myAnswer,
  onSourceMaterialChange,
  onMyAnswerChange,
  onSubmit,
  isLoading,
  progress,
  statusText,
}: InputSectionProps) {
  const canSubmit = !isLoading;
  const checklistItems = [
    '材料完整',
    '答案成文',
    'Markdown 输出',
    '建议复盘',
  ] as const;

  return (
    <section className='ink-panel p-5 sm:p-6 lg:p-8'>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='flex items-center font-running-script text-3xl font-normal text-ink sm:text-4xl'>
            <span className='mr-3 flex h-10 w-10 items-center justify-center rounded-[4px] border border-ink-light/15 bg-paper/80 text-ink shadow-sm'>
              <PenLine className='h-5 w-5' aria-hidden='true' />
            </span>
            输入区域
          </h2>
          <div className='mt-3 flex flex-wrap gap-2'>
            {checklistItems.map((item, index) => (
              <span
                key={item}
                className='rounded-[4px] border border-ink-light/10 bg-paper/70 px-3 py-1 font-kaishu text-xs text-ink'
              >
                {index + 1}. {item}
              </span>
            ))}
          </div>
        </div>

        <Link
          to='/history'
          className='ink-hover inline-flex items-center justify-center gap-2 rounded-[4px] border border-ink-light/15 bg-paper-rice/70 px-4 py-2 font-kaishu text-base shadow-sm transition-all duration-200 hover:-translate-y-0.5'
        >
          <History className='h-4 w-4' aria-hidden='true' />
          批改历史
        </Link>
      </div>

      <div className='mb-6 rounded-[8px] border border-ink-light/10 bg-paper/45 p-4'>
        <label
          htmlFor='sourceMaterial'
          className='mb-3 flex flex-wrap items-center gap-2 font-kaishu text-lg text-ink'
        >
          <FileText className='h-5 w-5 text-seal-red' aria-hidden='true' />
          请输入材料与要求：
          <span className='text-sm text-ink-wash'>
            （粘贴或输入完整的写作任务）
          </span>
        </label>
        <div className='relative'>
          <Textarea
            id='sourceMaterial'
            value={sourceMaterial}
            onChange={e => onSourceMaterialChange(e.target.value)}
            placeholder='在此粘贴或输入任务给定材料及具体写作要求...'
            className='notebook-lines h-64 resize-y rounded-[4px] border-ink-light/15 bg-paper/85 pr-12 font-kaishu text-base leading-8 shadow-none placeholder:text-ink-wash/50 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-seal/20'
          />
          {sourceMaterial && (
            <button
              onClick={() => onSourceMaterialChange('')}
              className='absolute right-3 top-3 rounded-[4px] bg-paper/70 p-2 text-ink-wash transition-colors hover:bg-ink hover:text-paper'
              type='button'
              aria-label='清空材料'
            >
              <X className='h-4 w-4' aria-hidden='true' />
            </button>
          )}
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 font-kaishu text-sm text-ink-wash'>
          <span className='rounded-[4px] border border-ink-light/15 bg-paper/80 px-3 py-1'>
            材料越完整，诊断越准确
          </span>
          <span>
            字数: {sourceMaterial.length}
            {sourceMaterial.length > 1000 && (
              <span className='ml-2 text-amber-700'>内容较长，建议精简</span>
            )}
          </span>
        </div>
      </div>

      {/* 答案输入区域 */}
      <div className='mb-8 rounded-[8px] border border-ink-light/10 bg-paper/45 p-4'>
        <label
          htmlFor='myAnswer'
          className='mb-3 flex flex-wrap items-center gap-2 font-kaishu text-lg text-ink'
        >
          <PenLine className='h-5 w-5 text-jade' aria-hidden='true' />
          请输入您的答案：
          <span className='text-sm text-ink-wash'>
            （您对上述要求的完整作答）
          </span>
        </label>
        <div className='relative'>
          <Textarea
            id='myAnswer'
            value={myAnswer}
            onChange={e => onMyAnswerChange(e.target.value)}
            placeholder='在此输入您对上述要求的作答内容...'
            className='notebook-lines h-64 resize-y rounded-[4px] border-ink-light/15 bg-paper/85 pr-12 font-kaishu text-base leading-8 shadow-none placeholder:text-ink-wash/50 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-seal/20'
          />
          {myAnswer && (
            <button
              onClick={() => onMyAnswerChange('')}
              className='absolute right-3 top-3 rounded-[4px] bg-paper/70 p-2 text-ink-wash transition-colors hover:bg-ink hover:text-paper'
              type='button'
              aria-label='清空答案'
            >
              <X className='h-4 w-4' aria-hidden='true' />
            </button>
          )}
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 font-kaishu text-sm text-ink-wash'>
          <span className='rounded-[4px] border border-ink-light/15 bg-paper/80 px-3 py-1'>
            建议先完成一稿，再按反馈二改
          </span>
          <span>
            字数: {myAnswer.length}
            {myAnswer.length < 100 && myAnswer.length > 0 && (
              <span className='ml-2 text-amber-700'>内容较少，建议完善</span>
            )}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      {isLoading && (
        <div className='mb-6 rounded-[6px] border border-ink-light/10 bg-paper/70 p-4'>
          <div className='h-3 w-full overflow-hidden rounded-[3px] bg-paper-rice'>
            <div
              className='h-3 rounded-[3px] bg-seal-red transition-all duration-200 ease-out'
              style={{ width: `${Math.min(100, Math.round(progress))}%` }}
            />
          </div>
          <div className='mt-3 flex items-center justify-between font-kaishu text-sm text-ink-wash'>
            <span className='flex items-center'>
              <Loader2 className='mr-2 h-4 w-4 animate-spin text-ink' />
              {statusText || '处理中...'}
            </span>
            <span className='font-running-script text-2xl text-ink'>
              {Math.min(100, Math.round(progress))}%
            </span>
          </div>
        </div>
      )}

      <div className='mb-6 rounded-[6px] border border-ink-light/10 bg-paper/65 px-4 py-3 font-kaishu text-sm leading-7 text-ink-wash'>
        批改将输出可直接阅读的 Markdown 评语，包含任务类型判断、整体评价和修改建议；提交前请确认材料与作答均已填写完整。
      </div>

      {/* 提交按钮 */}
      <div className='text-center'>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          type='button'
          className='ink-hover inline-flex w-full items-center justify-center gap-2 rounded-[4px] border border-ink bg-ink px-7 py-4 text-center font-kaishu text-lg text-paper shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0'
        >
          {isLoading ? (
            <span className='flex items-center justify-center'>
              <Loader2 className='mr-2 h-5 w-5 animate-spin' />
              AI批改中...
            </span>
          ) : (
            <span className='flex items-center justify-center'>
              <BookOpenCheck className='mr-2 h-5 w-5' aria-hidden='true' />
              开始AI批改
              <Send className='ml-1 h-4 w-4' aria-hidden='true' />
            </span>
          )}
        </button>
      </div>
    </section>
  );
}
