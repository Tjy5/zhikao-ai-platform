import type { RawWritingFeedbackResult, RawWritingStreamEvent } from '../../../types';

export type WritingStreamEvent = RawWritingStreamEvent;
export type RawGradingResult = RawWritingFeedbackResult;

export const buildWritingContent = (sourceMaterial: string, myAnswer: string) =>
  `【材料与要求】\n${sourceMaterial}\n\n【我的作答】\n${myAnswer}`;

const normalizeContent = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeContentFormat = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'markdown';
  }
  return value.trim();
};

export const isFinalStreamPayload = (event: WritingStreamEvent) =>
  event.stage === 2 &&
  event.progress === 100 &&
  event.partial === false &&
  normalizeContent(event.content).length > 0;

export const isFinalGradingPayload = (rawData: RawGradingResult) =>
  normalizeContent(rawData?.content).length > 0;

export const normalizeFinalStreamResult = (
  event: WritingStreamEvent
): RawGradingResult => ({
  content: normalizeContent(event.content),
  contentFormat: normalizeContentFormat(event.contentFormat),
});

export const normalizeGradingResult = (
  rawData: RawGradingResult
): RawGradingResult => ({
  content: normalizeContent(rawData?.content),
  contentFormat: normalizeContentFormat(rawData?.contentFormat),
});
