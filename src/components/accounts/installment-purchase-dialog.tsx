"use client";

import { useState, useTransition } from "react";
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
import { createInstallmentPurchase } from "@/actions/credit-cards";

interface CategoryOption {
  id: string;
  name: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lança compra parcelada no cartão (gera N parcelas + faturas). */
export function InstallmentPurchaseDialog({
  accountId,
  categories,
  trigger,
}: {
  accountId: string;
  categories: CategoryOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("2");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayIsoDate());

  function resetForm() {
    setDescription("");
    setTotalAmount("");
    setTotalInstallments("2");
    setCategoryId("");
    setDate(todayIsoDate());
  }

  function handleSubmit() {
    const installments = Number(totalInstallments);
    if (!description.trim() || !totalAmount || !Number.isFinite(installments) || installments < 1) {
      toast.error("Preencha descrição, valor e número de parcelas.");
      return;
    }

    startTransition(async () => {
      try {
        await createInstallmentPurchase({
          accountId,
          categoryId: categoryId || null,
          totalAmount,
          description: description.trim(),
          date,
          totalInstallments: installments,
        });
        toast.success(`Compra em ${installments}x lançada.`);
        setOpen(false);
        resetForm();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao lançar parcelamento.");
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
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compra parcelada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inst-description">Descrição</Label>
            <Input
              id="inst-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Notebook Dell"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inst-amount">Valor total (R$)</Label>
              <Input
                id="inst-amount"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-count">Parcelas</Label>
              <Input
                id="inst-count"
                type="number"
                min={1}
                max={48}
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inst-date">Data da compra</Label>
            <Input id="inst-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Categoria (opcional)</Label>
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Lançando…" : "Confirmar parcelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
