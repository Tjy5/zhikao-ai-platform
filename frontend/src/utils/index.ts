/**
 * 工具函数集合
 * 包含应用中可复用的工具方法
 */

import { formatTime as _formatTime } from './formatters';

/**
 * 文本清理函数
 * 移除内部提示短语，优化用户界面显示
 */
export const sanitizeText = (text: string): string => {
  if (!text) return text;
  try {
    let cleanText = text;
    const patterns: RegExp[] = [
      /as an ai (language )?model[,\s]?/gi,
      /i cannot (?:assist|comply).*?\.?\s*/gi,
      /openai.*?guidelines:?\s*/gi,
      /system prompt:?\s*/gi,
      /internal instructions:?\s*/gi,
      /��Ϊ���������ľ�ר��["'\""]?���["'\""]?��.*?[��:]\s*/g,
      /��Ϊ.*?�ľ�ר��.*?��.*?[��:]\s*/g,
      /���.*?רҵ.*?[��:]\s*/g,
      /���רҵ���[��:]\s*/g,
      /【[^】]*?(淘宝店铺|通关达人资料库)[^】]*】.*?/g,
      /(淘宝店铺|通关达人资料库)[^，。]*[，。]?/g,
      /一站式备考，持续更新/g,
    ];

    for (const pattern of patterns) {
      cleanText = cleanText.replace(pattern, '');
    }

    return cleanText.trimStart();
  } catch {
    return text;
  }
};

/**
 * 格式化HTML内容
 * 将文本转换为带格式的HTML
 */
export const formatTextToHtml = (text: string): string => {
  const t = sanitizeText(text);
  return t
    .replace(/\\n/g, '\n') // 将字面量\n转换为真实换行符
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '</p><p class="mb-4 mt-4">')
    .replace(/\n/g, '<br/>')
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-blue-700 font-medium">$1</strong>'
    )
    .replace(/^/, '<p class="mb-4">')
    .replace(/$/, '</p>');
};

/**
 * 解析专用的排版优化：
 * - 清理广告后分段
 * - 将 ①②③/1.2.3. 等条目渲染为 <ul><li>
 * - 强调关键结论词
 */
export const formatExplanationToHtml = (text: string): string => {
  if (!text) return '';
  const t = sanitizeText(text)
    .replace(/\r\n/g, '\n')
    .replace(/\u3000/g, ' ') // 全角空格
    .trim();

  // 段落按空行分段
  const paragraphs = t
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const bulletMarker =
    /^(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d+[\.|、\)]|[一二三四五六七八九十][、\.\)]|\([1-9]\))/;
  const emphasize = (s: string) =>
    s.replace(
      /(因此|所以|故|结论|建议选|答案为|应选|可知|由此)/g,
      '<strong class="text-blue-700">$1</strong>'
    );

  const htmlParts: string[] = [];
  for (const p of paragraphs) {
    const lines = p
      .split(/\n/)
      .map(l => l.trim())
      .filter(Boolean);
    // 判断是否列表段
    if (lines.length >= 2 && lines.every(l => bulletMarker.test(l))) {
      const lis = lines
        .map(l =>
          l.replace(
            /^([①②③④⑤⑥⑦⑧⑨⑩]|\d+[\.|、\)]|[一二三四五六七八九十][、\.\)]|\([1-9]\))\s*/,
            ''
          )
        )
        .map(l => `<li>${emphasize(l)}</li>`) // 强调关键字
        .join('');
      htmlParts.push(`<ul class="list-disc pl-5 space-y-1">${lis}</ul>`);
    } else {
      // 普通段落内也支持按行小点
      if (lines.some(l => bulletMarker.test(l))) {
        const lis = lines
          .map(l =>
            bulletMarker.test(l)
              ? `<li>${emphasize(l.replace(bulletMarker, ''))}</li>`
              : `<div class="mb-1">${emphasize(l)}</div>`
          )
          .join('');
        htmlParts.push(`<div class="mb-3">${lis}</div>`);
      } else {
        htmlParts.push(`<p class="mb-3 leading-7">${emphasize(p)}</p>`);
      }
    }
  }

  return htmlParts.join('');
};

/**
 * 数字转换工具
 * 安全地将未知值转换为数字
 */
export const toNumber = (value: unknown, defaultValue = 0): number => {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : defaultValue;
};

/**
 * 时间格式化
 * 将秒数转换为分:秒格式
 */
export const formatTime = _formatTime;

export { cn } from '@/lib/utils';
export { resolveImageUrl } from './image';
