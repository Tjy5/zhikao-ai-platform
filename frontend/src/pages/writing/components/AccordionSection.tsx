/**
 * 手风琴组件
 * 可折叠的内容展示区域
 */

import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  className = '',
}: AccordionSectionProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {/* 标题按钮 */}
      <button
        onClick={onToggle}
        className='mb-4 flex w-full items-center justify-between rounded-[4px] border border-transparent p-3 text-left font-kaishu text-lg text-ink transition-colors hover:border-ink-light/15 hover:bg-paper/75 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30'
        type='button'
      >
        <div className='flex items-center'>
          {icon}
          {title}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-ink-wash transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden='true'
        />
      </button>

      {/* 可折叠内容 */}
      {isOpen && (
        <div className='transition-all duration-300 ease-in-out'>
          {children}
        </div>
      )}
    </div>
  );
}
