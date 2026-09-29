import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium text-ink-3">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink md:text-2xl">{title}</h1>
        {description && <p className="mt-1 line-clamp-2 text-[13px] text-ink-3 md:line-clamp-none md:text-sm">{description}</p>}
      </div>
      {/* Phones: one swipeable row of actions instead of a tall stack of buttons. */}
      {actions && (
        <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
