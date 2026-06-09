/**
 * 评分细则表格组件
 * 展示详细的评分维度和分数
 */

'use client';

import { formatTextToHtml } from '../../../utils';
import type { ScoreDetail } from '../../../types';

interface ScoreDetailsTableProps {
  scoreDetails: ScoreDetail[];
  className?: string;
}

export default function ScoreDetailsTable({
  scoreDetails,
  className = '',
}: ScoreDetailsTableProps) {
  // 计算显示比例，确保总分为100
  const displayScale = (() => {
    const rawTotal = scoreDetails.reduce(
      (sum, detail) => sum + detail.fullScore,
      0
    );
    return rawTotal > 0 && Math.abs(rawTotal - 100) > 0.1 ? 100 / rawTotal : 1;
  })();

  const totalFullScore = scoreDetails.reduce(
    (sum, detail) => sum + detail.fullScore * displayScale,
    0
  );
  const totalActualScore = scoreDetails.reduce(
    (sum, detail) => sum + detail.actualScore,
    0
  );

  return (
    <div
      className={`overflow-hidden rounded-[6px] border border-ink-light/15 bg-paper/90 shadow-sm ${className}`}
    >
      <div className='overflow-x-auto'>
        <table className='w-full'>
          {/* 表头 */}
          <thead className='border-b border-ink-light/15 bg-paper-rice/70'>
            <tr>
              <th className='px-6 py-3 text-left font-kaishu text-xs uppercase text-ink-wash'>
                评分项
              </th>
              <th className='px-6 py-3 text-center font-kaishu text-xs uppercase text-ink-wash'>
                满分
              </th>
              <th className='px-6 py-3 text-center font-kaishu text-xs uppercase text-ink-wash'>
                得分
              </th>
              <th className='px-6 py-3 text-left font-kaishu text-xs uppercase text-ink-wash'>
                评分说明
              </th>
            </tr>
          </thead>

          {/* 表格内容 */}
          <tbody className='divide-y divide-ink-light/10 bg-paper/90'>
            {scoreDetails.map((detail, index) => {
              const scaledFullScore = Number(
                (detail.fullScore * displayScale).toFixed(1)
              );
              const scorePercentage =
                (detail.actualScore / (scaledFullScore || 1)) * 100;

              const getScoreColor = () => {
                if (scorePercentage >= 80) return 'text-landscape-green';
                if (scorePercentage >= 60) return 'text-amber-700';
                return 'text-seal-red';
              };

              const getProgressColor = () => {
                if (scorePercentage >= 80) return 'bg-landscape-green';
                if (scorePercentage >= 60) return 'bg-gold-accent';
                return 'bg-seal-red';
              };

              return (
                <tr
                  key={index}
                  className='transition-colors hover:bg-peach-soft/30'
                >
                  {/* 评分项名称 */}
                  <td className='whitespace-nowrap px-6 py-4 font-kaishu text-sm text-ink'>
                    <div className='flex items-center'>
                      <div className='mr-3 h-3 w-3 rounded-[2px] bg-seal-red'></div>
                      {detail.item}
                    </div>
                  </td>

                  {/* 满分 */}
                  <td className='whitespace-nowrap px-6 py-4 text-center text-sm text-ink-wash'>
                    {scaledFullScore}分
                  </td>

                  {/* 得分 */}
                  <td className='whitespace-nowrap px-6 py-4 text-center'>
                    <div>
                      <span
                        className={`text-sm font-semibold ${getScoreColor()}`}
                      >
                        {detail.actualScore}分
                      </span>
                      <div className='mt-2 h-2 w-full rounded-full bg-paper-rice'>
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
                          style={{
                            width: `${Math.min(100, scorePercentage)}%`,
                          }}
                        />
                      </div>
                      <div className='mt-1 text-xs text-ink-wash'>
                        {Math.round(scorePercentage)}%
                      </div>
                    </div>
                  </td>

                  {/* 评分说明 */}
                  <td className='px-6 py-4 font-kaishu text-sm text-ink'>
                    <div className='max-w-md leading-loose'>
                      <div
                        className='ai-feedback-content'
                        style={{ lineHeight: '1.8' }}
                        dangerouslySetInnerHTML={{
                          __html: formatTextToHtml(detail.description),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* 表格底部汇总 */}
          <tfoot className='border-t border-ink-light/15 bg-paper-rice/70'>
            <tr>
              <td className='px-6 py-3 font-kaishu text-sm text-ink'>
                <div className='flex items-center'>
                  <div className='mr-3 h-3 w-3 rounded-[2px] bg-ink'></div>
                  总计
                </div>
              </td>
              <td className='px-6 py-3 text-center font-kaishu text-sm text-ink'>
                {Number(totalFullScore.toFixed(1))}分
              </td>
              <td className='px-6 py-3 text-center text-sm font-bold text-seal-red'>
                {totalActualScore}分
              </td>
              <td className='px-6 py-3 text-sm text-ink-wash'>
                <div>
                  <div className='font-medium'>
                    综合得分率：
                    {Math.round(
                      (totalActualScore / Math.max(1, totalFullScore)) * 100
                    )}
                    %
                  </div>
                  <div className='mt-1 text-xs'>基于AI专业评分算法</div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 评分说明 */}
      <div className='border-t border-ink-light/15 bg-peach-soft/25 px-6 py-4'>
        <h4 className='mb-2 font-kaishu text-sm text-ink'>评分标准说明</h4>
        <div className='grid grid-cols-1 gap-4 text-xs text-ink-wash md:grid-cols-3'>
          <div className='flex items-center'>
            <div className='mr-2 h-3 w-3 rounded-[2px] bg-landscape-green'></div>
            <span>80分以上：优秀</span>
          </div>
          <div className='flex items-center'>
            <div className='mr-2 h-3 w-3 rounded-[2px] bg-gold-accent'></div>
            <span>60-79分：良好</span>
          </div>
          <div className='flex items-center'>
            <div className='mr-2 h-3 w-3 rounded-[2px] bg-seal-red'></div>
            <span>60分以下：需改进</span>
          </div>
        </div>
      </div>
    </div>
  );
}
