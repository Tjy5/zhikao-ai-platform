import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SECTION_LABELS } from '../../app/study/baseline';
import type { SectionKey } from '../../types/api';

/**
 * SectionEditor — structured text editor for one study section (design.md §6).
 *
 * NOT a raw JSON editor (ordinary users proposing changes must be able to use
 * it). Drives off a per-section schema that covers the 9 sections' shared shape:
 *  - string fields       → <Input> / <textarea>
 *  - string[] lists      → add / remove / edit rows
 *  - nested object lists → recursive sub-cards (study-route.steps,
 *                          training-plan.weeks)
 *  - nested object group → recursive sub-card (training-plan.review)
 *
 * Submit serializes the draft via JSON.stringify (structural only — the backend
 * re-validates). Malformed initialContent OR an explicit "高级模式" toggle
 * drops into a raw JSON textarea so editing never dead-ends on an unknown
 * shape. The PARENT owns the API call (propose/edit) + 403 special-case; this
 * component only produces `{ contentJson, changeSummary }`.
 */

// ----------------------------------------------------------------------------
// Schema — one entry per section_key. Covers the 9 baseline shapes.
// ----------------------------------------------------------------------------

type EditorField =
  | { kind: 'string'; key: string; label: string; multiline?: boolean }
  | { kind: 'stringList'; key: string; label: string }
  | {
      kind: 'objectList';
      key: string;
      label: string;
      itemLabel: string;
      itemFields: EditorField[];
    }
  | { kind: 'objectGroup'; key: string; label: string; fields: EditorField[] };

interface SectionSchema {
  /** Whether content_json root is an object or an array. */
  root: 'object' | 'array';
  /** For root='array': per-item fields + singular label. */
  arrayItemLabel?: string;
  arrayItemFields?: EditorField[];
  /** For root='object': top-level fields. */
  fields?: EditorField[];
}

const SCHEMAS: Record<SectionKey, SectionSchema> = {
  'study-route': {
    root: 'object',
    fields: [
      { kind: 'string', key: 'lead', label: '导语', multiline: true },
      {
        kind: 'objectList',
        key: 'steps',
        label: '步骤',
        itemLabel: '步骤',
        itemFields: [
          { kind: 'string', key: 'label', label: '步骤名' },
          { kind: 'string', key: 'desc', label: '说明', multiline: true },
        ],
      },
    ],
  },
  'exam-scan': {
    root: 'array',
    arrayItemLabel: '卡片',
    arrayItemFields: [
      { kind: 'string', key: 'title', label: '标题' },
      { kind: 'string', key: 'eyebrow', label: '眉标' },
      { kind: 'string', key: 'summary', label: '摘要', multiline: true },
      { kind: 'stringList', key: 'points', label: '要点' },
    ],
  },
  'review-rules': {
    root: 'array',
    arrayItemLabel: '规则',
    arrayItemFields: [
      { kind: 'string', key: 'title', label: '标题' },
      { kind: 'string', key: 'cue', label: '提示语' },
      { kind: 'string', key: 'detail', label: '详解', multiline: true },
    ],
  },
  'material-moves': {
    root: 'array',
    arrayItemLabel: '卡片',
    arrayItemFields: [
      { kind: 'string', key: 'title', label: '标题' },
      { kind: 'string', key: 'eyebrow', label: '眉标' },
      { kind: 'string', key: 'summary', label: '摘要', multiline: true },
      { kind: 'stringList', key: 'points', label: '要点' },
    ],
  },
  'question-guides': {
    root: 'array',
    arrayItemLabel: '题型',
    arrayItemFields: [
      { kind: 'string', key: 'title', label: '标题' },
      { kind: 'string', key: 'badge', label: '标签' },
      { kind: 'string', key: 'principle', label: '原则', multiline: true },
      { kind: 'stringList', key: 'method', label: '作答方法' },
      { kind: 'stringList', key: 'variants', label: '变形题处理' },
      { kind: 'stringList', key: 'mistakes', label: '高频误区' },
    ],
  },
  'format-matrix': {
    root: 'array',
    arrayItemLabel: '文种',
    arrayItemFields: [
      { kind: 'string', key: 'genre', label: '文种' },
      { kind: 'string', key: 'format', label: '推荐格式' },
      { kind: 'string', key: 'body', label: '正文重点', multiline: true },
      { kind: 'string', key: 'caution', label: '避坑', multiline: true },
    ],
  },
  'essay-rules': {
    root: 'array',
    arrayItemLabel: '规则',
    arrayItemFields: [
      { kind: 'string', key: 'title', label: '标题' },
      { kind: 'string', key: 'detail', label: '详解', multiline: true },
      { kind: 'stringList', key: 'checks', label: '自检项' },
    ],
  },
  pitfalls: {
    root: 'array',
    arrayItemLabel: '误区',
    arrayItemFields: [
      { kind: 'string', key: 'issue', label: '问题', multiline: true },
      { kind: 'string', key: 'correction', label: '纠正', multiline: true },
    ],
  },
  'training-plan': {
    root: 'object',
    fields: [
      {
        kind: 'objectList',
        key: 'weeks',
        label: '周次',
        itemLabel: '周次',
        itemFields: [
          { kind: 'string', key: 'week', label: '周次标识' },
          { kind: 'string', key: 'title', label: '标题' },
          { kind: 'string', key: 'focus', label: '重点', multiline: true },
          { kind: 'stringList', key: 'tasks', label: '任务' },
        ],
      },
      {
        kind: 'objectGroup',
        key: 'review',
        label: '复盘口径',
        fields: [
          { kind: 'string', key: 'title', label: '标题' },
          { kind: 'stringList', key: 'paragraphs', label: '段落' },
        ],
      },
    ],
  },
};

// ----------------------------------------------------------------------------
// Helpers — clone + record/array narrowing.
// ----------------------------------------------------------------------------

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Coerce initialContent into a mutable draft matching the schema root kind. */
function initDraft(schema: SectionSchema, content: unknown): unknown {
  if (schema.root === 'object') {
    return isRecord(content) ? clone(content) : {};
  }
  return Array.isArray(content) ? clone(content) : [];
}

// ----------------------------------------------------------------------------
// Field editors.
// ----------------------------------------------------------------------------

const INPUT_BASE =
  'w-full px-3 py-2 rounded-md border bg-paper text-ink text-[13px] ' +
  'placeholder:text-faint transition-ui border-line focus:border-ink focus:outline-none';

function StringField({
  label,
  value,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-mute mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${INPUT_BASE} leading-relaxed resize-y min-h-[72px]`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_BASE}
        />
      )}
    </label>
  );
}

function StringListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const update = (i: number, v: string) => {
    const next = value.slice();
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([...value, '']);
  };
  return (
    <div>
      <span className="block text-[12px] font-medium text-mute mb-1">{label}</span>
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className={INPUT_BASE}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 mt-0.5 w-8 h-8 rounded-md text-mute hover:text-mark hover:bg-panel border border-line transition-ui"
              aria-label={`删除第 ${i + 1} 项`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-4 h-4 mx-auto"
                aria-hidden="true"
              >
                <path
                  d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-ink hover:text-oxblood transition-ui"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-3.5 h-3.5"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        添加一项
      </button>
    </div>
  );
}

/**
 * Render a list of fields against an object value, dispatching by kind.
 * Recurses for objectList / objectGroup. `onChange` returns a new object with
 * the edited key replaced.
 */
function FieldsRenderer({
  fields,
  value,
  onChange,
}: {
  fields: EditorField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.kind === 'string') {
          const raw = value[field.key];
          const v = typeof raw === 'string' ? raw : '';
          return (
            <StringField
              key={field.key}
              label={field.label}
              multiline={field.multiline}
              value={v}
              onChange={(nv) => onChange({ ...value, [field.key]: nv })}
            />
          );
        }
        if (field.kind === 'stringList') {
          const raw = value[field.key];
          const arr = Array.isArray(raw)
            ? raw.filter((x) => typeof x === 'string')
            : [];
          return (
            <StringListField
              key={field.key}
              label={field.label}
              value={arr as string[]}
              onChange={(nv) => onChange({ ...value, [field.key]: nv })}
            />
          );
        }
        if (field.kind === 'objectList') {
          const raw = value[field.key];
          const arr = Array.isArray(raw)
            ? (raw.filter(isRecord) as Record<string, unknown>[])
            : [];
          return (
            <ObjectListEditor
              key={field.key}
              label={field.label}
              itemLabel={field.itemLabel}
              itemFields={field.itemFields}
              value={arr}
              onChange={(nv) => onChange({ ...value, [field.key]: nv })}
            />
          );
        }
        // objectGroup
        const raw = value[field.key];
        const obj = isRecord(raw) ? raw : {};
        return (
          <ObjectGroupEditor
            key={field.key}
            label={field.label}
            fields={field.fields}
            value={obj}
            onChange={(nv) => onChange({ ...value, [field.key]: nv })}
          />
        );
      })}
    </div>
  );
}

function ObjectListEditor({
  label,
  itemLabel,
  itemFields,
  value,
  onChange,
}: {
  label: string;
  itemLabel: string;
  itemFields: EditorField[];
  value: Record<string, unknown>[];
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const update = (i: number, item: Record<string, unknown>) => {
    const next = value.slice();
    next[i] = item;
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, {}]);
  return (
    <div>
      <span className="block text-[12px] font-medium text-mute mb-1.5">{label}</span>
      <ul className="space-y-2.5">
        {value.map((item, i) => (
          <li
            key={i}
            className="rounded-lg border border-line bg-panel/60 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-mute">
                {itemLabel} {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[11px] font-medium text-mute hover:text-mark transition-ui"
                aria-label={`删除${itemLabel} ${i + 1}`}
              >
                删除
              </button>
            </div>
            <FieldsRenderer
              fields={itemFields}
              value={item}
              onChange={(nv) => update(i, nv)}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-ink hover:text-oxblood transition-ui"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-3.5 h-3.5"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        添加{itemLabel}
      </button>
    </div>
  );
}

function ObjectGroupEditor({
  label,
  fields,
  value,
  onChange,
}: {
  label: string;
  fields: EditorField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel/60 p-3.5">
      <span className="block text-[12px] font-medium text-mute mb-3">{label}</span>
      <FieldsRenderer fields={fields} value={value} onChange={onChange} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// JSON advanced-mode fallback.
// ----------------------------------------------------------------------------

function JsonModeEditor({
  initial,
  onChange,
}: {
  initial: unknown;
  onChange: (parsed: unknown | null, error: string | null) => void;
}) {
  const [text, setText] = useState(() => {
    try {
      return JSON.stringify(initial, null, 2);
    } catch {
      return '';
    }
  });

  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-mute mb-1">
        内容 JSON（高级模式）
      </span>
      <textarea
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          try {
            onChange(JSON.parse(v), null);
          } catch (err) {
            onChange(
              null,
              err instanceof Error ? err.message : 'JSON 解析失败'
            );
          }
        }}
        rows={18}
        spellCheck={false}
        className={`${INPUT_BASE} font-mono text-[12px] leading-relaxed resize-y min-h-[280px]`}
      />
    </label>
  );
}

// ----------------------------------------------------------------------------
// SectionEditor — top level.
// ----------------------------------------------------------------------------

export interface SectionEditorProps {
  sectionKey: SectionKey;
  initialContent: unknown;
  /** 'propose' (user) or 'edit' (admin) — only affects button copy. */
  mode: 'propose' | 'edit';
  /** Parent-owned API call; receives the serialized payload. */
  onSubmit: (payload: {
    contentJson: unknown;
    changeSummary?: string;
  }) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SectionEditor({
  sectionKey,
  initialContent,
  mode,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: SectionEditorProps) {
  const schema = SCHEMAS[sectionKey];
  const sectionLabel = SECTION_LABELS[sectionKey];

  // Whether initialContent is well-formed enough for structured mode.
  const initialStructuredOk = useMemo(() => {
    if (!schema) return false;
    return schema.root === 'object' ? isRecord(initialContent) : Array.isArray(initialContent);
  }, [schema, initialContent]);

  const [structuredMode, setStructuredMode] = useState(initialStructuredOk);
  const [draft, setDraft] = useState<unknown>(() =>
    initDraft(schema, initialContent)
  );
  const [jsonParsed, setJsonParsed] = useState<unknown | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitText = mode === 'edit' ? '保存修改（即时生效）' : '提交修改建议';

  const handleSubmit = () => {
    setSubmitError(null);
    let contentJson: unknown;
    if (structuredMode) {
      contentJson = draft;
    } else {
      if (jsonError) {
        setSubmitError('JSON 解析失败，请修正后再提交。');
        return;
      }
      contentJson = jsonParsed;
    }
    // Structural serialization guard — must be JSON-serializable.
    try {
      JSON.stringify(contentJson);
    } catch {
      setSubmitError('内容无法序列化为 JSON，请检查。');
      return;
    }
    void onSubmit({
      contentJson,
      changeSummary: changeSummary.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
              编辑内容
            </div>
            <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-ink">
              {sectionLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setStructuredMode((v) => !v)}
            className="text-[11px] font-mono text-mute hover:text-ink transition-ui"
          >
            {structuredMode ? '切换到高级模式（JSON）' : '切换到结构化模式'}
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-mute leading-relaxed">
          {mode === 'edit'
            ? '管理员直改：保存后即时生效，并产生一条新版本记录。'
            : '提交后由管理员审核；通过前不会改变当前页面。'}
        </p>
      </div>

      {/* change summary */}
      <label className="block">
        <span className="block text-[12px] font-medium text-mute mb-1">
          变更摘要（可选）
        </span>
        <input
          type="text"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="一句话说明改了什么，便于审核"
          className={INPUT_BASE}
        />
      </label>

      {structuredMode ? (
        schema.root === 'object' ? (
          <FieldsRenderer
            fields={schema.fields ?? []}
            value={isRecord(draft) ? draft : {}}
            onChange={(nv) => setDraft(nv)}
          />
        ) : (
          <ObjectListEditor
            label={`${schema.arrayItemLabel ?? '项'}列表`}
            itemLabel={schema.arrayItemLabel ?? '项'}
            itemFields={schema.arrayItemFields ?? []}
            value={Array.isArray(draft) ? (draft.filter(isRecord) as Record<string, unknown>[]) : []}
            onChange={(nv) => setDraft(nv)}
          />
        )
      ) : (
        <JsonModeEditor
          initial={initialContent}
          onChange={(parsed, err) => {
            setJsonParsed(parsed);
            setJsonError(err);
          }}
        />
      )}

      {jsonError && !structuredMode && (
        <p className="text-[12px] text-mark leading-relaxed">JSON 错误：{jsonError}</p>
      )}
      {submitError && (
        <p className="text-[12px] text-mark leading-relaxed">{submitError}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          variant={mode === 'edit' ? 'primary' : 'outline'}
          size="sm"
          onClick={handleSubmit}
          isLoading={isSubmitting}
        >
          {submitText}
        </Button>
      </div>
    </div>
  );
}

export default SectionEditor;
