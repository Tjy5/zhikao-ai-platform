"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Import API configuration
import { API_BASE_URL } from '../config/api';

const getApiUrl = () => {
  return API_BASE_URL;
};

interface ScoreDetail {
  item: string;
  fullScore: number;
  actualScore: number;
  description: string;
}

interface GradingResult {
  score: number;
  feedback: string;
  suggestions: string[];
  scoreDetails?: ScoreDetail[];
  questionType?: string;
  questionTypeSource?: "ai" | "client" | string;
}

export default function Home() {
  const [questionMaterial, setQuestionMaterial] = useState<string>("");
  const [myAnswer, setMyAnswer] = useState<string>("");
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const progressTimerRef = useRef<NodeJS.Timer | null>(null);

  const startProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current as unknown as number);
      progressTimerRef.current = null;
    }
    setProgress(0);
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      const inc = current < 60 ? 3 : current < 85 ? 1.5 : current < 95 ? 0.5 : 0.2;
      current = Math.min(99, current + inc);
      setProgress(current);
    }, 200);
  };

  const finishProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current as unknown as number);
      progressTimerRef.current = null;
    }
    setProgress(100);
  };

  // Display normalization: scale "fullScore" so that totals sum to 100
  // Prefer ReactMarkdown rendering to preserve structure and bullets

  const displayScale = gradingResult?.scoreDetails?.length
    ? (() => {
        const raw = gradingResult.scoreDetails!.reduce((sum, d) => sum + d.fullScore, 0);
        return raw > 0 && Math.abs(raw - 100) > 0.1 ? 100 / raw : 1;
      })()
    : 1;

  const handleSubmit = async () => {
    if (!questionMaterial.trim()) {
      alert("请输入题目材料和问题");
      return;
    }
    if (!myAnswer.trim()) {
      alert("请输入您的答案");
      return;
    }

    setIsLoading(true);
    startProgress();
    try {
      // 将题目材料和用户答案组合成完整内容
      const combinedContent = `【题目材料及问题】\n${questionMaterial}\n\n【我的答案】\n${myAnswer}`;
      
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/essays/grade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: combinedContent,
          // question_type 现在是可选的，AI会自动判断题型
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const raw: unknown = await response.json();
      const rawRecord = raw as Record<string, unknown>;
      console.log("Raw grading result:", raw);
      console.log("Raw feedback content:", rawRecord?.feedback);
      // Normalize API shape to ensure scoreDetails shows up
      const toNumber = (v: unknown, def = 0) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : def;
      };
      const normalizeDetails = (details: unknown): ScoreDetail[] | undefined => {
        if (!details) return undefined;
        const detailsRecord = details as Record<string, unknown>;
        const arr = Array.isArray(details)
          ? details
          : Array.isArray(detailsRecord?.data)
          ? detailsRecord.data
          : Array.isArray(detailsRecord?.items)
          ? detailsRecord.items
          : Array.isArray(detailsRecord?.scoreDetails)
          ? detailsRecord.scoreDetails
          : Array.isArray(detailsRecord?.score_details)
          ? detailsRecord.score_details
          : undefined;
        if (!arr) return undefined;
        const mapped = arr
          .map((d: unknown) => {
            const detail = d as Record<string, unknown>;
            return {
              item: String(detail?.item ?? detail?.name ?? detail?.title ?? ""),
              fullScore: toNumber(detail?.fullScore ?? detail?.full_score ?? detail?.full ?? detail?.max ?? 100, 100),
              actualScore: toNumber(detail?.actualScore ?? detail?.actual_score ?? detail?.score ?? detail?.value ?? 0, 0),
              description: String(detail?.description ?? detail?.desc ?? detail?.detail ?? ""),
            };
          })
          .filter((d: ScoreDetail) => d.item !== "");
        return mapped.length ? mapped : undefined;
      };

      const normalized: GradingResult = {
        score: toNumber(rawRecord?.score, 0),
        feedback: typeof rawRecord?.feedback === "string" ? rawRecord.feedback : String(rawRecord?.feedback ?? ""),
        suggestions: Array.isArray(rawRecord?.suggestions)
          ? (rawRecord.suggestions as unknown[]).map((s: unknown) => String(s))
          : rawRecord?.suggestions
          ? [String(rawRecord.suggestions)]
          : [],
        scoreDetails:
          normalizeDetails(rawRecord?.scoreDetails) ??
          normalizeDetails(rawRecord?.score_details),
        questionType: typeof rawRecord?.questionType === "string" ? rawRecord.questionType : undefined,
        questionTypeSource: typeof rawRecord?.questionTypeSource === "string" ? rawRecord.questionTypeSource : undefined,
      };

      // As a last resort, synthesize a single detail if backend omitted it
      if (!normalized.scoreDetails || normalized.scoreDetails.length === 0) {
        normalized.scoreDetails = [
          {
            item: "综合评价",
            fullScore: 100,
            actualScore: toNumber(normalized.score, 0),
            description: "系统未返回评分细则，已用总分占比代替",
          },
        ];
      }

      console.log("Normalized grading result:", normalized);
      setGradingResult(normalized);
    } catch (error) {
      console.error("批改请求失败:", error);
      alert("批改请求失败，请检查网络连接或稍后重试");
    } finally {
      finishProgress();
      setTimeout(() => setIsLoading(false), 200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            智能AI公考申论批改
          </h1>
          <p className="text-gray-600">
            输入题目材料和您的答案，AI将自动识别题型并提供专业的智能批改和建议
          </p>
        </div>

        {/* 主要内容区域 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 题目材料和问题输入区域 */}
          <div className="mb-6">
            <label htmlFor="questionMaterial" className="block text-lg font-semibold text-gray-700 mb-3">
              请输入题目材料和问题：
            </label>
            <textarea
              id="questionMaterial"
              value={questionMaterial}
              onChange={(e) => setQuestionMaterial(e.target.value)}
              placeholder="在此粘贴或输入题目给定材料及具体问题要求..."
              className="w-full h-48 p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-700 leading-relaxed"
            />
            <div className="text-right text-sm text-gray-500 mt-2">
              字数: {questionMaterial.length}
            </div>
          </div>

          {/* 我的答案输入区域 */}
          <div className="mb-6">
            <label htmlFor="myAnswer" className="block text-lg font-semibold text-gray-700 mb-3">
              请输入您的答案：
            </label>
            <textarea
              id="myAnswer"
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
              placeholder="在此输入您对上述问题的答题内容..."
              className="w-full h-48 p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-700 leading-relaxed"
            />
            <div className="text-right text-sm text-gray-500 mt-2">
              字数: {myAnswer.length}
            </div>
          </div>

          {/* 提交按钮 */}
          {isLoading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.min(100, Math.round(progress))}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500 text-right">{Math.min(100, Math.round(progress))}%</div>
            </div>
          )}

          <div className="mb-8 text-center">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !questionMaterial.trim() || !myAnswer.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl mr-4"
            >
              {isLoading ? "批改中..." : "提交批改"}
            </button>
            {/* <button
              onClick={() => {
                // 测试数据
                setGradingResult({
                  score: 85.0,
                  feedback: "测试反馈",
                  suggestions: ["建议1", "建议2"],
                  scoreDetails: [
                    { item: "审题拆解能力", fullScore: 25, actualScore: 21, description: "准确识别题型，审题精准" },
                    { item: "搜寻组件能力", fullScore: 30, actualScore: 26, description: "全面搜寻材料要点" },
                    { item: "逻辑重构能力", fullScore: 35, actualScore: 30, description: "逻辑清晰，分析深入" },
                    { item: "规范作答能力", fullScore: 10, actualScore: 8, description: "结构规范，表达准确" }
                  ]
                });
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              测试评分细则
            </button> */}
          </div>

          {/* 批改结果展示区域 */}
          {gradingResult && (
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-8 border border-gray-200 shadow-lg">
              {gradingResult?.questionType && (
                <div className="mb-4">
                  <span className="inline-flex items-center text-sm text-gray-700 bg-white px-3 py-1 rounded-full border border-gray-200">
                    识别题型：{gradingResult.questionType}
                    {gradingResult.questionTypeSource === "ai" && (
                      <span className="ml-2 text-xs text-blue-600">(AI 识别)</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-3 shadow-sm"></div>
                  批改结果
                </h2>
                <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                  AI 智能分析
                </div>
              </div>

              {/* 分数显示 */}
              <div className="mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <svg className="w-6 h-6 mr-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-lg font-semibold text-gray-700">综合评分</span>
                    </div>
                    <div className="text-right">
                      <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {gradingResult.score}
                      </span>
                      <span className="text-lg text-gray-500 ml-1">分</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-4 rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{ width: `${gradingResult.score}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>0分</span>
                    <span>100分</span>
                  </div>
                </div>
              </div>

              {/* 评分细则 */}
              {gradingResult.scoreDetails && gradingResult.scoreDetails.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    评分细则
                  </h3>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">评分项</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">满分</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">得分</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">评分说明</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {gradingResult.scoreDetails.map((detail, index) => {
                            const scaledFull = Number((detail.fullScore * displayScale).toFixed(1));
                            const scorePercentage = (detail.actualScore / (scaledFull || 1)) * 100;
                            const getScoreColor = () => {
                              if (scorePercentage >= 80) return "text-green-600";
                              if (scorePercentage >= 60) return "text-yellow-600";
                              return "text-red-600";
                            };
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {detail.item}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                                  {Number((detail.fullScore * displayScale).toFixed(1))}分
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <span className={`text-sm font-semibold ${getScoreColor()}`}>
                                    {detail.actualScore}分
                                  </span>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-500 ${
                                        scorePercentage >= 80 ? "bg-green-500" :
                                        scorePercentage >= 60 ? "bg-yellow-500" : "bg-red-500"
                                      }`}
                                      style={{ width: `${scorePercentage}%` }}
                                    ></div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        // 自定义markdown组件，突出显示关键信息
                                        p: ({children}) => (
                                          <p className="mb-2 last:mb-0">{children}</p>
                                        ),
                                        strong: ({children}) => (
                                          <strong className="font-semibold text-gray-900">{children}</strong>
                                        ),
                                        // 为特殊标记添加样式
                                        text: ({children}) => {
                                          if (typeof children === 'string') {
                                            if (children.includes('✅')) {
                                              return <span className="text-green-700 font-medium">{children}</span>;
                                            }
                                            if (children.includes('⚠️')) {
                                              return <span className="text-yellow-700 font-medium">{children}</span>;
                                            }
                                            if (children.includes('❌')) {
                                              return <span className="text-red-700 font-medium">{children}</span>;
                                            }
                                            if (children.includes('💡')) {
                                              return <span className="text-blue-700 font-medium">{children}</span>;
                                            }
                                          }
                                          return <>{children}</>;
                                        }
                                      }}
                                    >
                                      {detail.description}
                                    </ReactMarkdown>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td className="px-6 py-3 text-sm font-semibold text-gray-900">总计</td>
                            <td className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                              {Number((gradingResult.scoreDetails.reduce((sum, detail) => sum + detail.fullScore * displayScale, 0)).toFixed(1))}分
                            </td>
                            <td className="px-6 py-3 text-center text-sm font-bold text-blue-600">
                              {gradingResult.scoreDetails.reduce((sum, detail) => sum + detail.actualScore, 0)}分
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-500">
                              综合得分率：{Math.round((gradingResult.scoreDetails.reduce((sum, detail) => sum + detail.actualScore, 0) / Math.max(1,
                                gradingResult.scoreDetails.reduce((sum, detail) => sum + detail.fullScore * displayScale, 0))) * 100)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 反馈信息 */}
              {gradingResult.feedback && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    详细反馈
                  </h3>
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {gradingResult.feedback}
                  </ReactMarkdown>
                  </div>
                  </div>
                </div>
              )}

              {/* 改进建议 */}
              {gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    改进建议
                  </h3>
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <ul className="space-y-3">
                      {gradingResult.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 mt-0.5">
                            <span className="text-white text-xs font-bold">{index + 1}</span>
                          </div>
                          <span className="text-gray-700 leading-relaxed">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
