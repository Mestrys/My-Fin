"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransfer } from "@/actions/transfers";
import type { AccountOption } from "@/components/dashboard/new-transaction-dialog";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Diálogo para transferência atômica entre duas contas próprias. */
export function TransferDialog({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Transferência entre contas");
  const [date, setDate] = useState(todayIsoDate());

  function resetForm() {
    setSourceAccountId(accounts[0]?.id ?? "");
    setDestinationAccountId(accounts[1]?.id ?? accounts[0]?.id ?? "");
    setAmount("");
    setDescription("Transferência entre contas");
    setDate(todayIsoDate());
  }

  function handleSubmit() {
    if (!sourceAccountId || !destinationAccountId || !amount) {
      toast.error("Preencha origem, destino e valor.");
      return;
    }
    if (sourceAccountId === destinationAccountId) {
      toast.error("Origem e destino devem ser contas diferentes.");
      return;
    }

    startTransition(async () => {
      try {
        await createTransfer({
          sourceAccountId,
          destinationAccountId,
          amount,
          date,
          description: description.trim() || "Transferência entre contas",
        });
        toast.success("Transferência registrada.");
        setOpen(false);
        resetForm();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao transferir.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button size="lg" variant="outline" className="gap-2 rounded-full">
            <ArrowLeftRight className="size-4" />
            Transferir
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferência entre contas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Conta de origem</Label>
            <Select value={sourceAccountId} onValueChange={(value) => setSourceAccountId(value as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a origem" />
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

          <div className="space-y-1.5">
            <Label>Conta de destino</Label>
            <Select
              value={destinationAccountId}
              onValueChange={(value) => setDestinationAccountId(value as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o destino" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount">Valor (R$)</Label>
              <Input
                id="transfer-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-date">Data</Label>
              <Input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-description">Descrição</Label>
            <Input
              id="transfer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Transferência entre contas"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={pending || accounts.length < 2}>
            {pending ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
