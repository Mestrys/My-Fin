import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

export interface SyncIndicatorData {
  status: "RUNNING" | "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";
  finishedAt: string | null;
  provider: string;
}

/** Indicador de sincronização bancária — reflete o `SyncLog` mais recente, sem placeholder. */
export function SyncIndicator({ lastSync }: { lastSync: SyncIndicatorData | null }) {
  if (!lastSync) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-on-surface-variant sm:flex">
        <RefreshCw className="size-3.5" />
        Nunca sincronizado
      </span>
    );
  }

  const Icon = lastSync.status === "SUCCESS" ? CheckCircle2 : lastSync.status === "FAILED" ? XCircle : RefreshCw;
  const label = lastSync.finishedAt
    ? `Sincronizado ${formatDateShort(lastSync.finishedAt)}`
    : "Sincronizando…";

  return (
    <span className="hidden items-center gap-1.5 text-xs text-on-surface-variant sm:flex">
      <Icon
        className={cn(
          "size-3.5",
          lastSync.status === "SUCCESS" && "text-income",
          lastSync.status === "FAILED" && "text-expense",
        )}
      />
      {label}
    </span>
  );
}
