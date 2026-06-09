import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  error: string | null;
}

export default function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className='mb-6 flex items-start gap-3 rounded-[6px] border border-seal-red/30 bg-seal-red/10 p-4 font-kaishu text-seal-red shadow-sm backdrop-blur'>
      <AlertTriangle className='mt-0.5 h-5 w-5 flex-none' aria-hidden='true' />
      <span>{error}</span>
    </div>
  );
}
