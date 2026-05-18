'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const STEPS = ['upload', 'select', 'edit', 'result'] as const;
type StepId = (typeof STEPS)[number];

interface ProgressStepperProps {
  step: StepId;
}

export function ProgressStepper({ step }: ProgressStepperProps) {
  const t = useTranslations('stepper');
  const activeIndex = STEPS.indexOf(step);

  return (
    <ol className="flex w-full items-center gap-2 sm:gap-3" aria-label="Progress">
      {STEPS.map((s, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.08 : 1 }}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-xs font-semibold ring-2 transition-colors',
                  isDone && 'bg-brand-600 text-white ring-brand-600',
                  isActive && 'bg-background text-brand-600 ring-brand-600',
                  !isDone && !isActive && 'bg-muted text-muted-foreground ring-transparent'
                )}
              >
                {isDone ? <Check className="size-4" /> : i + 1}
              </motion.div>
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {t(s)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn('h-px flex-1 transition-colors', i < activeIndex ? 'bg-brand-500' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
