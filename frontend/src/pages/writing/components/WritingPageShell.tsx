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
      title='申论智能批改'
      context='申论批改'
      description='把材料、题干和作答放进同一张训练工作台，交给 AI 生成评分、扣分原因和下一次作答建议。'
      actions={[
        { label: '查看复盘档案', to: '/history', variant: 'primary' },
        { label: '返回首页', to: '/', variant: 'secondary' },
      ]}
      metrics={[
        { label: '工作流', value: '申论' },
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
