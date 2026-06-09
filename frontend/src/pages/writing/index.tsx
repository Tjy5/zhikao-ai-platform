'use client';

import WritingPageShell from './components/WritingPageShell';
import { useWritingGrading } from './hooks/useWritingGrading';

export default function WritingPage() {
  const writingGrading = useWritingGrading();

  return <WritingPageShell {...writingGrading} />;
}
