'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className='mb-4 text-3xl font-semibold tracking-normal text-ink'
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className='mb-3 mt-6 text-2xl font-semibold tracking-normal text-ink'
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className='mb-2 mt-5 text-xl font-semibold tracking-normal text-ink'
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className='mb-4 leading-8 text-ink' {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className='mb-4 list-disc space-y-2 pl-6 text-ink' {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className='mb-4 list-decimal space-y-2 pl-6 text-ink' {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className='leading-8 text-ink' {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className='mb-4 border-l-4 border-seal-red/35 bg-peach-soft/20 px-4 py-3 text-ink-wash'
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }) => (
    <a
      className='break-all text-seal-red underline decoration-seal-red/30 underline-offset-4'
      target='_blank'
      rel='noreferrer'
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ inline, children, className, ...props }: any) =>
    inline ? (
      <code
        className='rounded-[4px] bg-paper-rice px-1.5 py-0.5 font-mono text-[0.95em] text-seal-red'
        {...props}
      >
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    ),
  pre: ({ children, ...props }) => (
    <pre
      className='mb-4 overflow-auto rounded-[6px] border border-ink-light/15 bg-ink-dark/95 p-4 font-mono text-sm leading-relaxed text-paper-rice shadow-inner'
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className='mb-4 overflow-x-auto'>
      <table
        className='w-full border-collapse overflow-hidden rounded-[6px] border border-ink-light/15 text-left'
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className='bg-paper-rice/70' {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className='border-b border-ink-light/15 px-4 py-3 text-sm text-ink' {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className='border-b border-ink-light/10 px-4 py-3 text-sm leading-7 text-ink' {...props}>
      {children}
    </td>
  ),
  hr: ({ ...props }) => (
    <hr className='my-6 border-ink-light/15' {...props} />
  ),
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({
  content,
  className = '',
}: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        skipHtml
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
