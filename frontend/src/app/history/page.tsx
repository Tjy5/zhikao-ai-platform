"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../config/api";

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
  request: any;
  response: any;
  extra?: any;
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
  const jsonSanitizer = (_key: string, value: any) =>
    typeof value === "string" ? sanitizeText(value) : value;

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api()}/api/v1/essays/history?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "加载失败");
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
    } catch (e: any) {
      setError(e?.message || "获取详情失败");
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
    } catch (e: any) {
      setError(e?.message || "操作失败");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers for structured rendering
  const normalizeDetails = (details: any): Array<{
    item: string;
    fullScore: number;
    actualScore: number;
    description: string;
  }> | undefined => {
    if (!details) return undefined;
    const rec: any = details as any;
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
    const toNumber = (v: any, def = 0) => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : def;
    };
    const mapped = (arr as any[])
      .map((d) => {
        const o: any = d || {};
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

  const scoreDetails = selected ? normalizeDetails((selected as any)?.response?.scoreDetails) : undefined;
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

  const copyJSON = async (obj: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, jsonSanitizer, 2));
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">历史记录</h1>
          <div className="space-x-3 flex items-center">
            <Link
              href="/"
              className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              返回首页
            </Link>
            <button
              onClick={loadList}
              className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={loading}
            >
              刷新
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              disabled={deleting}
            >
              清空
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">最近 50 条</h2>
              {loading && <span className="text-sm text-gray-500">加载中...</span>}
            </div>

            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 ID/类型/题型"
                className="w-56 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">类型</label>
                <select
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
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
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">题型</label>
                <select
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
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
              <div className="ml-auto text-xs text-gray-500">共 {filteredItems.length} 条</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      时间
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      类型
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      题型
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      分数
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && items.length === 0 &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`s-${i}`} className="animate-pulse">
                        <td className="px-4 py-2">
                          <div className="h-4 w-32 bg-gray-200 rounded" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="h-4 w-20 bg-gray-200 rounded" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="h-4 w-24 bg-gray-200 rounded" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="h-4 w-12 bg-gray-200 rounded" />
                        </td>
                        <td className="px-4 py-2" />
                      </tr>
                    ))}

                  {filteredItems.map((it) => {
                    const ts = it.timestamp ? new Date(it.timestamp) : null;
                    const tsStr = ts ? ts.toLocaleString() : "";
                    return (
                      <tr key={it.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{tsStr}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {it.type ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                              {it.type}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {it.questionType ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs">
                              {it.questionType}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                          {typeof it.score === "number" ? it.score.toFixed(1) : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => loadDetail(it.id)}
                            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                            🗂️
                          </div>
                          <div className="text-sm">暂无历史记录</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">详情</h2>
              {selected && (
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500">ID: {selected.id}</span>
                  <button
                    className={`px-3 py-1.5 text-xs rounded-md border ${showRaw ? "bg-gray-100 text-gray-700" : "bg-white text-gray-600"} hover:bg-gray-100`}
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? "结构化视图" : "原始 JSON"}
                  </button>
                  {!showRaw && (
                    <button
                      className="px-3 py-1.5 text-xs rounded-md border bg-white text-gray-600 hover:bg-gray-100"
                      onClick={() => copyJSON((selected as any)?.response ?? selected)}
                    >
                      复制 JSON
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-4">
              {!selected && <div className="text-gray-500">选择一条记录查看详情</div>}

              {selected && showRaw && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">请求</div>
                    <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto border border-gray-200">
                      {JSON.stringify(selected.request, jsonSanitizer, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">响应</div>
                    <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto border border-gray-200">
                      {JSON.stringify(selected.response, jsonSanitizer, 2)}
                    </pre>
                  </div>
                  {selected.extra && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">额外</div>
                      <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto border border-gray-200">
                        {JSON.stringify(selected.extra, jsonSanitizer, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {selected && !showRaw && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-600">{niceDate(selected.timestamp)}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selected.type}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                      {(selected as any)?.response?.questionType || (selected as any)?.request?.question_type || ""}
                    </span>
                    {typeof (selected as any)?.response?.score === "number" && (
                      <span
                        className={`ml-auto px-3 py-1 rounded-md text-white ${
                          (selected as any).response.score >= 80
                            ? "bg-green-500"
                            : (selected as any).response.score >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      >
                        总分 {(selected as any).response.score.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Score Details */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">评分明细</div>
                    {scoreDetails && scoreDetails.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">指标</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">满分</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">得分</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">说明</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {scoreDetails.map((d, idx) => {
                              const full = (d.fullScore || 0) * displayScale;
                              const pct = full > 0 ? Math.max(0, Math.min(100, (d.actualScore / full) * 100)) : 0;
                              return (
                                <tr key={idx}>
                                  <td className="px-4 py-2 text-sm text-gray-800 whitespace-nowrap">{d.item}</td>
                                  <td className="px-4 py-2 text-center text-sm text-gray-600 whitespace-nowrap">
                                    {Number(full.toFixed(1))}
                                  </td>
                                  <td className="px-4 py-2 text-center text-sm text-gray-800 whitespace-nowrap">
                                    {d.actualScore}
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                      <div
                                        className={`h-1.5 rounded-full ${
                                          pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      ></div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-700">
                                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeText(d.description)
                                            .replace(/\n/g, "<br/>")
                                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">暂无评分明细</div>
                    )}
                  </div>

                  {/* Feedback */}
                  {(selected as any)?.response?.feedback && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">详细反馈</div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div
                          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeText(String((selected as any).response.feedback))
                              .replace(/\n/g, "<br/>")
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {Array.isArray((selected as any)?.response?.suggestions) &&
                    (selected as any).response.suggestions.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">改进建议</div>
                        <ul className="space-y-2">
                          {(selected as any).response.suggestions.map((s: any, i: number) => (
                            <li key={i} className="flex items-start">
                              <span className="flex-shrink-0 w-6 h-6 mr-2 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">
                                {i + 1}
                              </span>
                              <span className="text-gray-700">{sanitizeText(String(s))}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

