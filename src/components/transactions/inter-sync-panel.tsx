"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importInter, type ImportInterResult } from "@/actions/import-inter";

interface AccountOption {
  id: string;
  name: string;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Painel de sincronização com a API Banking PJ do Banco Inter (mTLS). */
export function InterSyncPanel({ accounts }: { accounts: AccountOption[] }) {
  const [expanded, setExpanded] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<ImportInterResult | null>(null);

  function handleSync() {
    if (!accountId) {
      toast.error("Selecione a conta de destino.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await importInter({ accountId, from, to });
        setLastResult(result);
        toast.success(
          `${result.recordsInserted} nova(s), ${result.recordsSkipped} já existiam (${result.recordsProcessed} lidas).`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao sincronizar com o Inter.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-on-surface"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="size-4" />
          Sincronizar Banco Inter
        </span>
        <span className="text-xs text-on-surface-variant">{expanded ? "Recolher" : "Expandir"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-outline-variant p-4">
          <p className="text-xs text-on-surface-variant">
            Requer `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, certificado mTLS em Base64 e `INTER_ACCOUNT_NUMBER` no ambiente.
            `INTER_ACCOUNT_NUMBER` no ambiente.
          </p>

          <div className="max-w-xs space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">Conta de destino</label>
            <Select value={accountId} onValueChange={(value) => setAccountId(value as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid max-w-md grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSync} disabled={pending || accounts.length === 0} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {pending ? "Sincronizando…" : "Buscar extrato"}
          </Button>

          {lastResult && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-surface-container-high py-2">
                <p className="font-semibold text-on-surface">{lastResult.recordsProcessed}</p>
                <p className="text-on-surface-variant">Lidos</p>
              </div>
              <div className="rounded-lg bg-income-container py-2">
                <p className="font-semibold text-income-on-container">{lastResult.recordsInserted}</p>
                <p className="text-income-on-container/80">Importados</p>
              </div>
              <div className="rounded-lg bg-surface-container-high py-2">
                <p className="font-semibold text-on-surface">{lastResult.recordsSkipped}</p>
                <p className="text-on-surface-variant">Deduplicados</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
