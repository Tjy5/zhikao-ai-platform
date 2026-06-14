import ReactMarkdown from 'react-markdown';

/**
 * Shared markdown renderer.
 *
 * Encapsulates the ReactMarkdown custom-component map used for both the
 * grading result page and the history detail panel, so the visual styling
 * stays consistent. Rendered output is visually identical to the previous
 * inline `components` map in `app/writing/grading/page.tsx`.
 */
interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export function MarkdownRenderer({ children, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ node: _node, ...props }) => (
            <h1 className="text-2xl font-display font-semibold text-deep-ink mt-6 mb-3" {...props} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2 className="text-xl font-display font-semibold text-deep-ink mt-5 mb-2" {...props} />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3 className="text-lg font-display font-semibold text-deep-ink mt-4 mb-2" {...props} />
          ),
          p: ({ node: _node, ...props }) => (
            <p className="text-deep-ink leading-relaxed mb-3" {...props} />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul className="list-disc list-inside text-deep-ink space-y-1 mb-3" {...props} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol className="list-decimal list-inside text-deep-ink space-y-1 mb-3" {...props} />
          ),
          li: ({ node: _node, ...props }) => (
            <li className="text-deep-ink" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="font-semibold text-vermilion" {...props} />
          ),
          em: ({ node: _node, ...props }) => (
            <em className="italic text-slate-gray" {...props} />
          ),
          code: ({ node: _node, ...props }) => (
            <code className="px-1.5 py-0.5 rounded bg-slate-gray/10 text-vermilion font-mono text-sm" {...props} />
          ),
          pre: ({ node: _node, ...props }) => (
            <pre className="p-4 rounded-md bg-deep-ink text-paper-white overflow-x-auto mb-3" {...props} />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote className="border-l-4 border-vermilion pl-4 italic text-slate-gray my-3" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
