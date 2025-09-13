"use client";

import { useRef, useState } from "react";
// Removed unused imports

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
  const [statusText, setStatusText] = useState<string>("");
  const progressTimerRef = useRef<NodeJS.Timer | null>(null);
  
  // UI state for accordion sections
  const [accordionState, setAccordionState] = useState({
    scoreDetails: true,    // 评分细则默认展开
    feedback: false,       // 详细反馈默认收起  
    suggestions: false     // 改进建议默认收起
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  // Hide internal prompt phrases from user-facing text
  const sanitizeText = (text: string) => {
    if (!text) return text;
    try {
      let t = text;
      const patterns: RegExp[] = [
        /作为资深申论阅卷专家["'“”]?悟道["'“”]?的.*?[：:]\s*/g,
        /作为.*?阅卷专家.*?的.*?[：:]\s*/g,
        /悟道.*?专业.*?[：:]\s*/g,
        /深度专业诊断[：:]\s*/g,
      ];
      for (const p of patterns) t = t.replace(p, "");
      return t.trimStart();
    } catch {
      return text;
    }
  };

  // Stream-first submit for better UX (partial results + live progress)
  const handleSubmitStream = async () => {
    if (!questionMaterial.trim()) {
      alert("请先填写题目材料或题干");
      return;
    }
    if (!myAnswer.trim()) {
      alert("请先填写你的作答");
      return;
    }

    setIsLoading(true);
    setStatusText("初始化...");
    startProgress();

    const combinedContent = `【题目材料与题干】\n${questionMaterial}\n\n【我的作答】\n${myAnswer}`;
    const apiUrl = getApiUrl();

    // Try progressive SSE over POST (fetch streaming)
    try {
      setStatusText("诊断中（阶段一）...");
      const res = await fetch(`${apiUrl}/api/v1/essays/grade-progressive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ content: combinedContent }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Stop local timer and use server-provided progress
      stopProgress();
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const toNumber = (v: unknown, def = 0) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : def;
      };
      const normalizeDetails = (details: unknown): ScoreDetail[] | undefined => {
        if (!details) return undefined;
        const detailsRecord = details as Record<string, unknown>;
        const arr = Array.isArray(details)
          ? (details as unknown[])
          : Array.isArray(detailsRecord?.data)
          ? (detailsRecord.data as unknown[])
          : Array.isArray(detailsRecord?.items)
          ? (detailsRecord.items as unknown[])
          : Array.isArray(detailsRecord?.scoreDetails)
          ? (detailsRecord.scoreDetails as unknown[])
          : Array.isArray(detailsRecord?.score_details)
          ? (detailsRecord.score_details as unknown[])
          : undefined;
        if (!arr) return undefined;
        const mapped = arr
          .map((d: unknown) => {
            const detail = d as Record<string, unknown>;
            return {
              item: String(detail?.item ?? detail?.name ?? detail?.title ?? ""),
              fullScore: toNumber(
                detail?.fullScore ?? detail?.full_score ?? detail?.full ?? detail?.max ?? 100,
                100
              ),
              actualScore: toNumber(
                detail?.actualScore ?? detail?.actual_score ?? detail?.score ?? detail?.value ?? 0,
                0
              ),
              description: String(detail?.description ?? detail?.desc ?? detail?.detail ?? ""),
            } as ScoreDetail;
          })
          .filter((d: ScoreDetail) => d.item !== "");
        return mapped.length ? mapped : undefined;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr) as Record<string, unknown>;
            const stage = evt?.stage;
            const qType = evt?.questionType as string | undefined;
            const qSrc = evt?.questionTypeSource as string | undefined;

            if (stage === 1) {
              setProgress(toNumber(evt?.progress, 50));
              setStatusText("已完成诊断，生成维度细则...");
              setGradingResult({
                score: 0,
                feedback: String(evt?.teacherComments ?? ""),
                suggestions: [],
                scoreDetails: normalizeDetails(evt?.scoreDetails),
                questionType: qType,
                questionTypeSource: qSrc,
              });
            } else if (stage === 2) {
              setProgress(100);
              setStatusText("完成评估");
              const details = normalizeDetails(evt?.scoreDetails) ?? undefined;
              setGradingResult((prev) => ({
                score: toNumber(evt?.score, 0),
                feedback: sanitizeText(String(evt?.feedback ?? "")),
                suggestions: Array.isArray(evt?.suggestions)
                  ? (evt?.suggestions as unknown[]).map((s) => sanitizeText(String(s)))
                  : [],
                scoreDetails: details
                  ? details.map(d => ({ ...d, description: sanitizeText(d.description) }))
                  : prev?.scoreDetails?.map(d => ({ ...d, description: sanitizeText(d.description) })),
                questionType: qType ?? prev?.questionType,
                questionTypeSource: qSrc ?? prev?.questionTypeSource,
              } as GradingResult));
            } else if (stage === "error") {
              throw new Error(String(evt?.message ?? "评分失败"));
            }
          } catch (err) {
            console.warn("SSE chunk parse failed", err);
          }
        }
      }

      setIsLoading(false);
      return;
    } catch (streamErr) {
      console.warn("Streaming failed, fallback to one-shot:", streamErr);
    }

    // Fallback: one-shot grading
    try {
      setStatusText("生成总体评估...");
      const response = await fetch(`${apiUrl}/api/v1/essays/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: combinedContent }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP error! status: ${response.status} ${errorText}`);
      }
      const raw: unknown = await response.json();
      const rawRecord = raw as Record<string, unknown>;
      const toNumber = (v: unknown, def = 0) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : def;
      };
      const normalizeDetails = (details: unknown): ScoreDetail[] | undefined => {
        if (!details) return undefined;
        const detailsRecord = details as Record<string, unknown>;
        const arr = Array.isArray(details)
          ? (details as unknown[])
          : Array.isArray(detailsRecord?.data)
          ? (detailsRecord.data as unknown[])
          : Array.isArray(detailsRecord?.items)
          ? (detailsRecord.items as unknown[])
          : Array.isArray(detailsRecord?.scoreDetails)
          ? (detailsRecord.scoreDetails as unknown[])
          : Array.isArray(detailsRecord?.score_details)
          ? (detailsRecord.score_details as unknown[])
          : undefined;
        if (!arr) return undefined;
        const mapped = arr
          .map((d: unknown) => {
            const detail = d as Record<string, unknown>;
            return {
              item: String(detail?.item ?? detail?.name ?? detail?.title ?? ""),
              fullScore: toNumber(
                detail?.fullScore ?? detail?.full_score ?? detail?.full ?? detail?.max ?? 100,
                100
              ),
              actualScore: toNumber(
                detail?.actualScore ?? detail?.actual_score ?? detail?.score ?? detail?.value ?? 0,
                0
              ),
              description: String(detail?.description ?? detail?.desc ?? detail?.detail ?? ""),
            } as ScoreDetail;
          })
          .filter((d: ScoreDetail) => d.item !== "");
        return mapped.length ? mapped : undefined;
      };

      const normalized: GradingResult = {
        score: toNumber(rawRecord?.score, 0),
        feedback: sanitizeText(
          typeof rawRecord?.feedback === "string" ? rawRecord.feedback : String(rawRecord?.feedback ?? "")
        ),
        suggestions: Array.isArray(rawRecord?.suggestions)
          ? (rawRecord.suggestions as unknown[]).map((s: unknown) => sanitizeText(String(s)))
          : rawRecord?.suggestions
          ? [sanitizeText(String(rawRecord.suggestions))]
          : [],
        scoreDetails: (normalizeDetails(rawRecord?.scoreDetails) ?? normalizeDetails(rawRecord?.score_details))?.map(d => ({
          ...d,
          description: sanitizeText(d.description),
        })),
        questionType: typeof rawRecord?.questionType === "string" ? rawRecord.questionType : undefined,
        questionTypeSource: typeof rawRecord?.questionTypeSource === "string" ? rawRecord.questionTypeSource : undefined,
      };
      if (!normalized.scoreDetails || normalized.scoreDetails.length === 0) {
        normalized.scoreDetails = [
          { item: "综合得分", fullScore: 100, actualScore: toNumber(normalized.score, 0), description: "系统未返回细则，按总分展示" },
        ];
      }
      setGradingResult(normalized);
      setStatusText("完成评估");
      finishProgress();
    } catch (error) {
      console.error("评分失败:", error);
      alert("评分失败：请检查网络或稍后重试");
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  // Stop progress without forcing completion
  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current as unknown as number);
      progressTimerRef.current = null;
    }
  };

  // Display normalization: scale "fullScore" so that totals sum to 100
  // Prefer ReactMarkdown rendering to preserve structure and bullets

  const displayScale = gradingResult?.scoreDetails?.length
    ? (() => {
        const raw = gradingResult.scoreDetails!.reduce((sum, d) => sum + d.fullScore, 0);
        return raw > 0 && Math.abs(raw - 100) > 0.1 ? 100 / raw : 1;
      })()
    : 1;

  // Removed unused handleSubmit function

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            智能AI公考申论批改
          </h1>
          <p className="text-gray-600">
            输入题目材料和您的答案，AI将自动识别题型并提供专业的智能批改和建议
          </p>
        </div>

        {/* 顶部操作区 */}
        <div className="mb-8 flex items-center justify-end">
          <a
            href="/history"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            历史记录
          </a>
        </div>

        {/* 左右分栏布局 - 左小右大 */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-8">
          {/* 左栏：输入区域 */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-4 shadow-sm"></div>
              输入区域
            </h2>

            {/* 题目材料和问题输入区域 */}
            <div className="mb-6">
              <label htmlFor="questionMaterial" className="block text-lg font-semibold text-gray-700 mb-3">
                请输入题目材料和问题：
              </label>
              <div className="relative">
                <textarea
                  id="questionMaterial"
                  value={questionMaterial}
                  onChange={(e) => setQuestionMaterial(e.target.value)}
                  placeholder="在此粘贴或输入题目给定材料及具体问题要求..."
                  className="w-full h-64 p-4 pr-12 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-y text-gray-700 leading-relaxed"
                />
                {questionMaterial && (
                  <button
                    onClick={() => setQuestionMaterial("")}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-right text-sm text-gray-500 mt-2">
                字数: {questionMaterial.length}
              </div>
            </div>

            {/* 我的答案输入区域 */}
            <div className="mb-8">
              <label htmlFor="myAnswer" className="block text-lg font-semibold text-gray-700 mb-3">
                请输入您的答案：
              </label>
              <div className="relative">
                <textarea
                  id="myAnswer"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value)}
                  placeholder="在此输入您对上述问题的答题内容..."
                  className="w-full h-64 p-4 pr-12 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-y text-gray-700 leading-relaxed"
                />
                {myAnswer && (
                  <button
                    onClick={() => setMyAnswer("")}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-right text-sm text-gray-500 mt-2">
                字数: {myAnswer.length}
              </div>
            </div>

            {/* 进度条 */}
            {isLoading && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${Math.min(100, Math.round(progress))}%` }}
                  />
                </div>
                <div className="mt-3 text-sm text-gray-600 flex items-center justify-between">
                  <span>{statusText || "处理中..."}</span>
                  <span>{Math.min(100, Math.round(progress))}%</span>
                </div>
              </div>
            )}

            {/* 提交按钮 */}
            <div className="text-center">
              <button
                onClick={handleSubmitStream}
                disabled={isLoading || !questionMaterial.trim() || !myAnswer.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                {isLoading ? "批改中..." : "开始AI批改"}
              </button>
            </div>
          </div>

          {/* 右栏：结果展示区域 */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            {!gradingResult ? (
              !isLoading ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                      <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-600 mb-4">等待批改结果</div>
                    <div className="text-lg text-gray-500">请先在左侧输入题目和答案</div>
                  </div>
                </div>
              ) : (
                // 加载中的骨架屏
                <div className="p-8 animate-pulse">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full mr-4 shadow-sm"></div>
                        <div className="h-6 bg-gray-300 rounded w-24"></div>
                      </div>
                      <div className="h-5 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                  
                  {/* 模拟综合评分骨架 */}
                  <div className="mb-8">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-amber-200 rounded mr-3"></div>
                          <div className="h-5 bg-gray-300 rounded w-20"></div>
                        </div>
                        <div className="text-right">
                          <div className="h-10 bg-gradient-to-r from-blue-200 to-purple-200 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                        <div className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 h-4 rounded-full w-3/4 animate-pulse"></div>
                      </div>
                      <div className="flex justify-between">
                        <div className="h-3 bg-gray-300 rounded w-8"></div>
                        <div className="h-3 bg-gray-300 rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 模拟手风琴标题骨架 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-indigo-200 rounded mr-2"></div>
                        <div className="h-5 bg-gray-300 rounded w-20"></div>
                      </div>
                      <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-green-200 rounded mr-2"></div>
                        <div className="h-5 bg-gray-300 rounded w-20"></div>
                      </div>
                      <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-blue-200 rounded mr-2"></div>
                        <div className="h-5 bg-gray-300 rounded w-20"></div>
                      </div>
                      <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                  
                  <div className="mt-8 text-center">
                    <div className="text-lg text-gray-500">AI 正在智能分析中...</div>
                    <div className="text-sm text-gray-400 mt-2">{statusText}</div>
                  </div>
                </div>
              )
            ) : (
              <div className="p-8 animate-fade-in"
                style={{
                  animation: 'fadeInUp 0.6s ease-out forwards',
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}
                onAnimationEnd={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.opacity = '1';
                  target.style.transform = 'translateY(0)';
                }}
              >
                <div className="mb-6">
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
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                      <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-4 shadow-sm"></div>
                      批改结果
                    </h2>
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                      AI 智能分析
                    </div>
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
                  <button 
                    onClick={() => toggleAccordion('scoreDetails')}
                    className="w-full text-left text-lg font-semibold text-gray-700 mb-4 flex items-center justify-between hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      评分细则
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${accordionState.scoreDetails ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {accordionState.scoreDetails && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ease-in-out">
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
                                    <div className="leading-loose">
                                      <div 
                                        className="ai-feedback-content"
                                        style={{
                                          lineHeight: '1.8',
                                        }}
                                        dangerouslySetInnerHTML={{ 
                                          __html: detail.description
                                            .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                            .replace(/\r\n/g, '\n')
                                            .replace(/\n\n+/g, '</p><p class="mb-3 mt-3">')
                                            .replace(/\n/g, '<br/>')
                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-medium">$1</strong>')
                                            .replace(/^/, '<p class="mb-3">')
                                            .replace(/$/, '</p>')
                                        }}
                                      />
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
                  )}
                </div>
              )}

              {/* 详细反馈 */}
              {gradingResult.feedback && (
                <div className="mb-8">
                  <button 
                    onClick={() => toggleAccordion('feedback')}
                    className="w-full text-left text-lg font-semibold text-gray-700 mb-4 flex items-center justify-between hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      详细反馈
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${accordionState.feedback ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {accordionState.feedback && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transition-all duration-300 ease-in-out">
                      <div className="text-gray-700">
                        <div 
                          className="ai-feedback-content"
                          style={{
                            lineHeight: '1.9',
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: gradingResult.feedback
                              .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                              .replace(/\r\n/g, '\n')
                              .replace(/\n\n+/g, '</p><p class="mb-5 mt-5">')
                              .replace(/\n/g, '<br/>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-semibold">$1</strong>')
                              .replace(/^/, '<p class="mb-5">')
                              .replace(/$/, '</p>')
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 改进建议 */}
              {gradingResult.suggestions && gradingResult.suggestions.length > 0 && (
                <div className="mb-8">
                  <button 
                    onClick={() => toggleAccordion('suggestions')}
                    className="w-full text-left text-lg font-semibold text-gray-700 mb-4 flex items-center justify-between hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      改进建议
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${accordionState.suggestions ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {accordionState.suggestions && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm transition-all duration-300 ease-in-out">
                      <ul className="space-y-5">
                        {gradingResult.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start">
                            <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4 mt-1 shadow-sm">
                              <span className="text-white text-sm font-bold">{index + 1}</span>
                            </div>
                            <div 
                              className="text-gray-700 flex-1"
                              style={{
                                lineHeight: '1.8',
                              }}
                              dangerouslySetInnerHTML={{
                                __html: suggestion
                                  .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                  .replace(/\r\n/g, '\n')
                                  .replace(/\n\n+/g, '</p><p class="mb-4 mt-4">')
                                  .replace(/\n/g, '<br/>')
                                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-medium">$1</strong>')
                                  .replace(/^/, '<p class="mb-4">')
                                  .replace(/$/, '</p>')
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
