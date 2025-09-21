"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../config/api";
import Navigation from "../../components/Navigation";

type HistoryItem = {
  id: string;
  timestamp?: string;
  type?: string;
  questionType?: string;
  score?: number;
};

type HistoryDetail = {
  id: string;
  timestamp?: string;
  type?: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

const api = () => API_BASE_URL;

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [qtypeFilter, setQtypeFilter] = useState<string>("all");

  // Sanitize AI outputs to hide internal/system prompt phrases
  const sanitizeText = (text: string) => {
    if (!text) return text;
    try {
      let t = text;
      const patterns: RegExp[] = [
        /as an ai (language )?model[,\s]?/gi,
        /i cannot (?:assist|comply).*?\.?\s*/gi,
        /openai.*?guidelines:?\s*/gi,
        /system prompt:?\s*/gi,
        /internal instructions:?\s*/gi,
        /作为[\S\s]{0,4}AI[\S\s]{0,4}模型[，,]*/g,
        /系统提示[：:]\s*/g,
        /内部指令[：:]\s*/g,
      ];
      for (const p of patterns) t = t.replace(p, "");
      return t.trimStart();
    } catch {
      return text;
    }
  };

  // Replacer for JSON.stringify to sanitize all string fields
  const jsonSanitizer = (_key: string, value: unknown) =>
    typeof value === "string" ? sanitizeText(value) : value;

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setError(null);
    setSelected(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelected(data as HistoryDetail);
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "获取详情失败");
    }
  };

  const clearAll = async () => {
    if (!confirm("确定清空所有历史记录？该操作不可恢复")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelected(null);
      await loadList();
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "操作失败");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  // Helpers for structured rendering
  const normalizeDetails = (details: unknown): Array<{
    item: string;
    fullScore: number;
    actualScore: number;
    description: string;
  }> | undefined => {
    if (!details) return undefined;
    const rec = details as Record<string, unknown>;
    const arr = Array.isArray(details)
      ? details
      : Array.isArray(rec?.data)
      ? rec.data
      : Array.isArray(rec?.items)
      ? rec.items
      : Array.isArray(rec?.scoreDetails)
      ? rec.scoreDetails
      : Array.isArray(rec?.score_details)
      ? rec.score_details
      : undefined;
    if (!arr) return undefined;
    const toNumber = (v: unknown, def = 0) => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : def;
    };
    const mapped = (arr as unknown[])
      .map((d) => {
        const o = (d as Record<string, unknown>) || {};
        return {
          item: String(o.item ?? o.name ?? o.title ?? ""),
          fullScore: toNumber(o.fullScore ?? o.full_score ?? o.full ?? o.max ?? 100, 100),
          actualScore: toNumber(o.actualScore ?? o.actual_score ?? o.score ?? o.value ?? 0, 0),
          description: String(o.description ?? o.desc ?? o.detail ?? ""),
        };
      })
      .filter((x) => x.item);
    return mapped.length ? mapped : undefined;
  };

  const scoreDetails = selected ? normalizeDetails(selected?.response?.scoreDetails) : undefined;
  const totalFullScore = scoreDetails?.reduce((s, d) => s + (d.fullScore || 0), 0) ?? 0;
  const displayScale = totalFullScore > 0 && Math.abs(totalFullScore - 100) > 0.1 ? 100 / totalFullScore : 1;
  const niceDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const byType = typeFilter === "all" || (it.type || "").toLowerCase() === typeFilter;
      const byQType = qtypeFilter === "all" || (it.questionType || "").toLowerCase() === qtypeFilter;
      const byQuery =
        !q ||
        (it.type || "").toLowerCase().includes(q) ||
        (it.questionType || "").toLowerCase().includes(q) ||
        (it.id || "").toLowerCase().includes(q);
      return byType && byQType && byQuery;
    });
  }, [items, query, typeFilter, qtypeFilter]);

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => (i.type || "").toLowerCase()).filter(Boolean))),
    [items]
  );
  const qtypeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => (i.questionType || "").toLowerCase()).filter(Boolean))),
    [items]
  );

  const copyJSON = async (obj: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, jsonSanitizer, 2));
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              📋 历史记录
            </h1>
            <p className="text-gray-600">
              查看您的申论批改历史，回顾学习轨迹
            </p>
          </div>

        {/* 顶部操作区 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回首页
            </Link>
            <button
              onClick={loadList}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm transition-colors"
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
          <button
            onClick={clearAll}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 shadow-sm transition-colors"
            disabled={deleting}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleting ? '清空中...' : '清空全部'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* 搜索和筛选区域 - 独立全宽卡片 */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex-1 min-w-80">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 ID、类型或题型..."
                  className="w-full pl-12 pr-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-700 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-base font-medium text-gray-700">类型</label>
                <select
                  className="px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white transition-colors"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">全部</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-base font-medium text-gray-700">题型</label>
                <select
                  className="px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white transition-colors"
                  value={qtypeFilter}
                  onChange={(e) => setQtypeFilter(e.target.value)}
                >
                  <option value="all">全部</option>
                  {qtypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-base text-gray-600 bg-gradient-to-br from-gray-50 to-blue-50 px-4 py-3 rounded-xl border border-gray-200">
                共 <span className="font-bold text-blue-600">{filteredItems.length}</span> 条记录
              </div>
            </div>
          </div>
        </div>

        {/* 左右分栏布局 - 各自独立的卡片 */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-8">
          {/* 左栏：历史记录列表 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                  <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-4 shadow-sm"></div>
                  最近记录
                </h2>
                {loading && (
                  <div className="flex items-center text-base text-gray-500">
                    <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    加载中...
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 max-h-[800px] overflow-y-auto">

              {/* 加载状态 */}
              {loading && items.length === 0 && (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`loading-${i}`} className="animate-pulse">
                      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <div className="flex items-center">
                          <div className="w-1.5 h-16 bg-gray-200 rounded-full mr-4"></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-3">
                              <div className="space-y-2">
                                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                                <div className="h-3 w-32 bg-gray-200 rounded"></div>
                              </div>
                              <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                            </div>
                            <div className="flex gap-2">
                              <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                              <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 记录列表 */}
              {!loading || items.length > 0 ? (
                <div className="space-y-2">
                  {filteredItems.map((it) => {
                    const ts = it.timestamp ? new Date(it.timestamp) : null;
                    const tsStr = ts ? ts.toLocaleString() : "";
                    const score = typeof it.score === "number" ? it.score : null;
                    const isSelected = selected && selected.id === it.id;
                    
                    // 根据分数确定颜色
                    const getScoreColor = () => {
                      if (score === null) return "bg-gray-400";
                      if (score >= 80) return "bg-green-500";
                      if (score >= 60) return "bg-yellow-500";
                      return "bg-red-500";
                    };

                    const getScoreTextColor = () => {
                      if (score === null) return "text-gray-600";
                      if (score >= 80) return "text-green-600";
                      if (score >= 60) return "text-yellow-600";
                      return "text-red-600";
                    };

                    return (
                      <div
                        key={it.id}
                        className={`group hover:bg-blue-50 rounded-lg border cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? "border-blue-500 bg-blue-50 shadow-sm" 
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() => loadDetail(it.id)}
                      >
                        <div className="flex items-center p-4">
                          {/* 彩色指示点 */}
                          <div className={`w-3 h-3 ${getScoreColor()} rounded-full mr-4 flex-shrink-0`}></div>
                          
                          {/* 主要信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm text-gray-500 truncate">
                                {tsStr || "未知时间"}
                              </div>
                              {score !== null && (
                                <div className={`text-sm font-semibold ${getScoreTextColor()}`}>
                                  {score.toFixed(1)}分
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                              {it.type && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                                  {it.type}
                                </span>
                              )}
                              {it.questionType && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-xs font-medium">
                                  {it.questionType}
                                </span>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-400 font-mono truncate">
                              {it.id.substring(0, 16)}...
                            </div>
                          </div>
                          
                          {/* 选中状态指示 */}
                          {isSelected && (
                            <div className="ml-3 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* 空状态 */}
              {filteredItems.length === 0 && !loading && (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-lg font-semibold text-gray-600 mb-2">暂无历史记录</div>
                  <div className="text-base text-gray-500">开始您的第一次申论批改吧</div>
                </div>
              )}
            </div>
          </div>

          {/* 右栏：详情视图 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg">
            {!selected ? (
              <div className="h-[900px] flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-gray-600 mb-4">请选择记录查看详情</div>
                  <div className="text-lg text-gray-500">点击左侧列表中的任意记录</div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-8 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                      <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-4 shadow-sm"></div>
                      详情信息
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg border font-mono">
                      ID: {selected.id.substring(0, 20)}...
                    </span>
                    <button
                      className={`px-4 py-2 text-sm rounded-xl border transition-colors ${
                        showRaw 
                          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                      onClick={() => setShowRaw((v) => !v)}
                    >
                      {showRaw ? "结构化视图" : "原始JSON"}
                    </button>
                    {!showRaw && (
                      <button
                        className="px-4 py-2 text-sm rounded-xl bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        onClick={() => copyJSON(selected?.response ?? selected)}
                      >
                        复制数据
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-8 max-h-[800px] overflow-y-auto">
                  {showRaw ? (
                    <div className="space-y-6">
                      <div>
                        <div className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          请求数据
                        </div>
                        <pre className="text-sm bg-gray-50 p-4 rounded-xl overflow-auto border border-gray-200 max-h-40 font-mono">
                          {JSON.stringify(selected.request, jsonSanitizer, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          响应数据
                        </div>
                        <pre className="text-sm bg-gray-50 p-4 rounded-xl overflow-auto border border-gray-200 max-h-48 font-mono">
                          {JSON.stringify(selected.response, jsonSanitizer, 2)}
                        </pre>
                      </div>
                      {selected.extra && (
                        <div>
                          <div className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                            </svg>
                            额外信息
                          </div>
                          <pre className="text-sm bg-gray-50 p-4 rounded-xl overflow-auto border border-gray-200 max-h-40 font-mono">
                            {JSON.stringify(selected.extra, jsonSanitizer, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* 概要信息 */}
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex items-center mb-5">
                          <svg className="w-5 h-5 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-lg font-bold text-gray-800">基本信息</span>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 font-medium">提交时间</span>
                            <span className="text-sm text-gray-700 font-medium">{niceDate(selected.timestamp)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 font-medium">类型</span>
                            <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-medium">
                              {selected.type}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 font-medium">题型</span>
                            <span className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-sm font-medium">
                              {String((selected?.response as Record<string, unknown>)?.questionType) || String((selected?.request as Record<string, unknown>)?.question_type) || "未识别"}
                            </span>
                          </div>
                          {typeof (selected?.response as Record<string, unknown>)?.score === "number" && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500 font-medium">总分</span>
                              <div className="flex items-center">
                                <span className={`text-2xl font-bold ${
                                  Number((selected?.response as Record<string, unknown>)?.score) >= 80
                                    ? "text-green-600"
                                    : Number((selected?.response as Record<string, unknown>)?.score) >= 60
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }`}>
                                  {Number((selected?.response as Record<string, unknown>)?.score).toFixed(1)}
                                </span>
                                <span className="text-sm text-gray-500 ml-2">分</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 评分明细 */}
                      {scoreDetails && scoreDetails.length > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200">
                          <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center">
                              <svg className="w-5 h-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                              评分明细
                            </h3>
                          </div>
                          <div className="p-6 space-y-5">
                            {scoreDetails.map((d, idx) => {
                              const full = (d.fullScore || 0) * displayScale;
                              const pct = full > 0 ? Math.max(0, Math.min(100, (d.actualScore / full) * 100)) : 0;
                              const getScoreColor = () => {
                                if (pct >= 80) return "text-green-600";
                                if (pct >= 60) return "text-yellow-600";
                                return "text-red-600";
                              };
                              
                              return (
                                <div key={idx} className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-5 border border-gray-100">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-base font-semibold text-gray-900">{d.item}</span>
                                    <div className="text-right">
                                      <span className={`text-lg font-bold ${getScoreColor()}`}>
                                        {d.actualScore}/{Number(full.toFixed(1))}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                                    <div
                                      className={`h-3 rounded-full transition-all duration-500 shadow-sm ${
                                        pct >= 80 ? "bg-gradient-to-r from-green-400 to-green-600" :
                                        pct >= 60 ? "bg-gradient-to-r from-yellow-400 to-yellow-600" : 
                                        "bg-gradient-to-r from-red-400 to-red-600"
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="text-sm text-gray-700 leading-relaxed">
                                    <div
                                      style={{
                                        lineHeight: '1.6',
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeText(d.description)
                                          .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                          .replace(/\r\n/g, '\n')
                                          .replace(/\n\n+/g, '</p><p class="mb-2 mt-2">')
                                          .replace(/\n/g, "<br/>")
                                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-medium">$1</strong>')
                                          .replace(/^/, '<p class="mb-2">')
                                          .replace(/$/, '</p>')
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* 详细反馈 */}
                      {(selected?.response as Record<string, unknown>)?.feedback ? (
                        <div className="bg-white rounded-xl border border-gray-200">
                          <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center">
                              <svg className="w-5 h-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              详细反馈
                            </h3>
                          </div>
                          <div className="p-6">
                            <div className="text-base text-gray-700 leading-loose">
                              <div
                                className="space-y-4"
                                style={{
                                  lineHeight: '1.8',
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeText(String((selected?.response as Record<string, unknown>)?.feedback))
                                    .replace(/\\n/g, '\n')  // 首先将字面量\n转换为真实换行符
                                    .replace(/\r\n/g, '\n')
                                    .replace(/\n\n+/g, '</p><p class="mb-4 mt-4">')
                                    .replace(/\n/g, "<br/>")
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-700 font-semibold">$1</strong>')
                                    .replace(/^/, '<p class="mb-4">')
                                    .replace(/$/, '</p>')
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* 改进建议 */}
                      {Array.isArray((selected?.response as Record<string, unknown>)?.suggestions) &&
                        ((selected?.response as Record<string, unknown>)?.suggestions as string[]).length > 0 ? (
                          <div className="bg-white rounded-xl border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                                <svg className="w-5 h-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                改进建议
                              </h3>
                            </div>
                            <div className="p-6">
                              <ul className="space-y-5">
                                {((selected?.response as Record<string, unknown>)?.suggestions as string[]).map((s: string, i: number) => (
                                  <li key={i} className="flex items-start">
                                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4 shadow-sm">
                                      <span className="text-white text-sm font-bold">{i + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                      <div 
                                        className="text-base text-gray-700 leading-relaxed"
                                        style={{
                                          lineHeight: '1.7',
                                        }}
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeText(String(s))
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
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : null}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

