import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

export default function WritingPage() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Content state
  const [content, setContent] = useState('');
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Statistics
  const charCount = content.length;

  // Mixed word/character count: count Chinese characters individually, English words by whitespace
  const wordCount = (() => {
    if (!content.trim()) return 0;

    // Match Chinese characters (CJK Unified Ideographs + extensions)
    const chineseChars = content.match(/[一-鿿㐀-䶿\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}豈-﫿㌀-㏿︰-﹏豈-﫿\u{2f800}-\u{2fa1f}]/gu);
    const chineseCount = chineseChars ? chineseChars.length : 0;

    // Remove Chinese characters and count remaining words by whitespace
    const nonChinese = content.replace(/[一-鿿㐀-䶿\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}豈-﫿㌀-㏿︰-﹏豈-﫿\u{2f800}-\u{2fa1f}]/gu, ' ').trim();
    const englishWords = nonChinese ? nonChinese.split(/\s+/).filter(w => w.length > 0).length : 0;

    return chineseCount + englishWords;
  })();

  const paragraphCount = content.trim() ? content.split(/\n\n+/).filter(p => p.trim()).length : 0;
  const estimatedTime = Math.ceil(charCount / 50); // Rough estimate: 50 chars/sec

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  };

  const handleSubmit = async () => {
    // Validation
    if (!content.trim()) {
      showToast('请输入写作内容', 'warning');
      return;
    }

    if (content.trim().length < 50) {
      showToast('内容过短，请至少输入50个字符', 'warning');
      return;
    }

    // Navigate to grading page with content
    // The grading page will handle SSE connection
    navigate('/app/writing/grading', { state: { content: content.trim() } });
  };

  return (
    <main id="main-content" className="min-h-screen bg-paper-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-display text-deep-ink mb-2">写作批改</h1>
          <p className="text-slate-gray">输入您的写作内容，AI 将为您提供详细的批改反馈</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Writing Input Area - 60% width on large screens */}
          <div className="lg:col-span-3">
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/20">
              <label htmlFor="writing-content" className="block text-lg font-semibold text-deep-ink mb-3">
                写作内容
              </label>

              <textarea
                ref={textareaRef}
                id="writing-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在此输入您的写作内容...

可以是议论文、记叙文、申论材料等任何文体。AI 将根据内容自动识别文体并提供针对性的批改建议。"
                className="
                  w-full min-h-[400px] max-h-[800px] px-4 py-3 rounded-md border border-slate-gray/30
                  bg-paper-white text-deep-ink
                  placeholder:text-slate-gray/50
                  focus:outline-none focus:ring-2 focus:ring-vermilion focus:border-vermilion
                  resize-none overflow-hidden
                  font-body leading-relaxed
                "
                style={{ lineHeight: '1.75' }}
              />

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!content.trim()}
                  size="lg"
                >
                  提交批改
                </Button>
              </div>
            </div>
          </div>

          {/* Statistics Panel - 40% width on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-card-cream rounded-lg p-6 border border-slate-gray/20 sticky top-8">
              <h2 className="text-lg font-semibold text-deep-ink mb-4">统计信息</h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-gray/20">
                  <span className="text-slate-gray">字符数</span>
                  <span className="text-2xl font-semibold text-deep-ink">{charCount}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-slate-gray/20">
                  <span className="text-slate-gray">字数</span>
                  <span className="text-2xl font-semibold text-deep-ink">{wordCount}</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-slate-gray/20">
                  <span className="text-slate-gray">段落数</span>
                  <span className="text-2xl font-semibold text-deep-ink">{paragraphCount}</span>
                </div>

                <div className="flex justify-between items-center py-3">
                  <span className="text-slate-gray">预计批改时间</span>
                  <span className="text-xl font-semibold text-vermilion">
                    {estimatedTime > 0 ? `~${estimatedTime}秒` : '-'}
                  </span>
                </div>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-paper-white rounded-md border border-slate-gray/20">
                <h3 className="text-sm font-semibold text-deep-ink mb-2">📝 写作建议</h3>
                <ul className="text-xs text-slate-gray space-y-1">
                  <li>• 建议字数在 300-1500 字之间</li>
                  <li>• 分段清晰，每段表达一个完整观点</li>
                  <li>• 检查标点符号和错别字</li>
                  <li>• 论据充分，逻辑清晰</li>
                </ul>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => {
                    if (content.trim()) {
                      setShowClearConfirm(true);
                    }
                  }}
                  className="w-full px-4 py-2 text-sm text-slate-gray hover:text-deep-ink border border-slate-gray/20 rounded-md hover:bg-paper-white transition-all"
                  disabled={!content.trim()}
                >
                  清空内容
                </button>

                <button
                  onClick={() => navigate('/app/history')}
                  className="w-full px-4 py-2 text-sm text-vermilion hover:text-vermilion/80 border border-vermilion/20 rounded-md hover:bg-vermilion/5 transition-all"
                >
                  查看历史记录
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, show: false })}
          />
        )}

        {/* Clear Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showClearConfirm}
          title="清空内容"
          message="确定要清空当前内容吗？此操作无法撤销。"
          confirmText="清空"
          cancelText="取消"
          variant="warning"
          onConfirm={() => {
            setContent('');
            setShowClearConfirm(false);
            setToast({ show: true, message: '内容已清空', type: 'success' });
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      </div>
    </main>
  );
}
