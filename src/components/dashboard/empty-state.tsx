import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-container-high">
        <Icon className="size-6 text-on-surface-variant" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-on-surface">{title}</p>
        <p className="max-w-sm text-sm text-on-surface-variant">{description}</p>
      </div>
      {action}
    </div>
  );
}
