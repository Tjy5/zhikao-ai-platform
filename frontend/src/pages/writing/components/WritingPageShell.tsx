'use client';

import type { Dispatch, SetStateAction } from 'react';

import type { RawWritingFeedbackResult } from '../../../types';
import InkWashShell from '../../../components/InkWashShell';
import WritingResultPanel from './WritingResultPanel';
import InputSection from './InputSection';

interface WritingPageShellProps {
  sourceMaterial: string;
  myAnswer: string;
  gradingResult: RawWritingFeedbackResult | null;
  isLoading: boolean;
  progress: number;
  statusText: string;
  setSourceMaterial: Dispatch<SetStateAction<string>>;
  setMyAnswer: Dispatch<SetStateAction<string>>;
  submitWriting: () => Promise<void>;
}

export default function WritingPageShell({
  sourceMaterial,
  myAnswer,
  gradingResult,
  isLoading,
  progress,
  statusText,
  setSourceMaterial,
  setMyAnswer,
  submitWriting,
}: WritingPageShellProps) {
  return (
    <InkWashShell
      title='智能写作反馈'
      context='智能写作反馈'
      description='把材料与要求和作答放进一张浅色工作台，交给 AI 生成可直接阅读的 Markdown 批改结果。'
      actions={[
        { label: '查看历史记录', to: '/history', variant: 'primary' },
        { label: '返回首页', to: '/', variant: 'secondary' },
      ]}
      metrics={[
        { label: '工作流', value: '批改' },
        { label: '结果', value: gradingResult ? '已生成' : '待提交' },
        {
          label: '进度',
          value: isLoading ? `${Math.min(100, Math.round(progress))}%` : '--',
        },
      ]}
    >
      <div className='grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]'>
        <InputSection
          sourceMaterial={sourceMaterial}
          myAnswer={myAnswer}
          onSourceMaterialChange={setSourceMaterial}
          onMyAnswerChange={setMyAnswer}
          onSubmit={submitWriting}
          isLoading={isLoading}
          progress={progress}
          statusText={statusText}
        />

        <WritingResultPanel
          result={gradingResult}
          isLoading={isLoading}
          statusText={statusText}
        />
      </div>
    </InkWashShell>
  );
}
