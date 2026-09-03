import { STATUS_LABELS } from '../lib/format';
import type { ApplicationStatus } from '../types/api';

type StepTone = 'complete' | 'completeMuted' | 'current' | 'upcoming' | 'accepted' | 'rejected';

interface StepData {
  label: string;
  tone: StepTone;
}

/** Pipeline position (0-2) or the shared Decision slot (3) for ACCEPTED/REJECTED. */
const STEP_INDEX: Record<ApplicationStatus, number> = {
  APPLIED: 0,
  REVIEWING: 1,
  SHORTLISTED: 2,
  ACCEPTED: 3,
  REJECTED: 3,
};

const CIRCLE_TONE_CLASSES: Record<StepTone, string> = {
  complete: 'bg-brand-600 text-white',
  completeMuted: 'bg-slate-400 text-white',
  current: 'border-2 border-brand-600 bg-white',
  accepted: 'bg-emerald-600 text-white',
  rejected: 'bg-red-600 text-white',
  upcoming: 'border border-slate-300 bg-white',
};

const LABEL_TONE_CLASSES: Record<StepTone, string> = {
  complete: 'text-slate-600',
  completeMuted: 'text-slate-500',
  current: 'font-semibold text-brand-700',
  accepted: 'text-emerald-700',
  rejected: 'text-red-700',
  upcoming: 'text-slate-400',
};

export function StatusStepper({ status }: { status: ApplicationStatus }) {
  const steps = buildSteps(status);
  const activeIndex = STEP_INDEX[status];

  return (
    <ol className="flex items-start" aria-label="Application progress">
      {steps.flatMap((step, index) => {
        const isCurrent = index === activeIndex;
        const stepItem = (
          <li
            key={step.label}
            className="flex flex-col items-center animate-fade-up"
            style={{ animationDelay: `${index * 60}ms` }}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${CIRCLE_TONE_CLASSES[step.tone]}`}
            >
              {stepIcon(step.tone)}
            </span>
            <span className={`mt-2 text-center text-xs sm:text-sm ${LABEL_TONE_CLASSES[step.tone]}`}>
              {step.label}
              {isCurrent ? (
                <span className="sr-only">{` (step ${index + 1} of ${steps.length}, current)`}</span>
              ) : null}
            </span>
          </li>
        );

        if (index === steps.length - 1) {
          return [stepItem];
        }

        return [
          stepItem,
          <li
            key={`${step.label}-connector`}
            aria-hidden="true"
            className={`mt-4 h-0.5 flex-1 animate-fade-in ${connectorClass(step.tone)}`}
            style={{ animationDelay: `${index * 60}ms` }}
          />,
        ];
      })}
    </ol>
  );
}

function buildSteps(status: ApplicationStatus): StepData[] {
  const activeIndex = STEP_INDEX[status];
  const isAccepted = status === 'ACCEPTED';
  const isRejected = status === 'REJECTED';

  const pipelineTone = (index: number): StepTone => {
    if (isAccepted) return 'complete';
    if (isRejected) return 'completeMuted';
    if (index < activeIndex) return 'complete';
    if (index === activeIndex) return 'current';
    return 'upcoming';
  };

  const decisionTone: StepTone = isAccepted ? 'accepted' : isRejected ? 'rejected' : 'upcoming';
  const decisionLabel = isAccepted ? STATUS_LABELS.ACCEPTED : isRejected ? STATUS_LABELS.REJECTED : 'Decision';

  return [
    { label: STATUS_LABELS.APPLIED, tone: pipelineTone(0) },
    { label: STATUS_LABELS.REVIEWING, tone: pipelineTone(1) },
    { label: STATUS_LABELS.SHORTLISTED, tone: pipelineTone(2) },
    { label: decisionLabel, tone: decisionTone },
  ];
}

function connectorClass(leftTone: StepTone): string {
  if (leftTone === 'complete') return 'bg-brand-600';
  if (leftTone === 'completeMuted') return 'bg-slate-400';
  return 'bg-slate-200';
}

function stepIcon(tone: StepTone) {
  if (tone === 'complete' || tone === 'completeMuted' || tone === 'accepted') {
    return <CheckIcon />;
  }
  if (tone === 'rejected') {
    return <XIcon />;
  }
  return null;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
