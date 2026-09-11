import { PeriodSegmentedControl } from "@/components/period-segmented-control";
import { PrivacyToggle } from "@/components/dashboard/privacy-toggle";
import { SyncIndicator, type SyncIndicatorData } from "@/components/dashboard/sync-indicator";
import {
  NewTransactionDialog,
  type AccountOption,
  type CategoryOption,
} from "@/components/dashboard/new-transaction-dialog";

export function TopAppBar({
  lastSync,
  accounts,
  categories,
}: {
  lastSync: SyncIndicatorData | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:px-6">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <PeriodSegmentedControl />
        <SyncIndicator lastSync={lastSync} />
      </div>
      <div className="flex items-center gap-2">
        <PrivacyToggle />
        <NewTransactionDialog accounts={accounts} categories={categories} />
      </div>
    </header>
  );
}
