
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight, Wallet as WalletIcon } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";
import { api } from "../lib/api";
import "./WalletPanel.css";

function formatMoney(cents: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

function parseMoney(value: string): string | null {
  const normalized = value.trim();

  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [reais, centavos = ""] = normalized.replace(",", ".").split(".");

  const amountCents =
    BigInt(reais) * 100n +
    BigInt(centavos.padEnd(2, "0"));

  if (amountCents <= 0n || amountCents > 9223372036854775807n) {
    return null;
  }

  return amountCents.toString();
}

export function WalletPanel() {
  const { user } = useAuth();
  const { data: wallet, isLoading, isError, refetch } = useWallet();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const depositMutation = useMutation({
    mutationFn: async (amountCents: string) => {
      await api.post("/wallet/deposits", { amountCents });
    },
    onSuccess: async () => {
      setAmount("");
      setError("");
      setSuccess("Depósito simulado realizado com sucesso!");

      await queryClient.invalidateQueries({
        queryKey: ["wallet", user?.id],
      });
    },
    onError: (err) => {
      setSuccess("");

      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.error;

        setError(
          typeof message === "string"
            ? message
            : "Não foi possível realizar o depósito.",
        );
      } else {
        setError("Não foi possível realizar o depósito.");
      }
    },
  });

  function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const amountCents = parseMoney(amount);

    if (!amountCents) {
      setError("Informe um valor positivo válido, com até duas casas decimais.");
      return;
    }

    depositMutation.mutate(amountCents);
  }

  if (!user || user.role !== "BIDDER") {
    return null;
  }

  return (
    <section className="wallet-panel">
      <div className="wallet-panel-heading">
        <WalletIcon size={20} />
        <span>MINHA CARTEIRA</span>
      </div>

      {isLoading ? (
        <p className="wallet-panel-message">CONSULTANDO SALDO...</p>
      ) : isError || !wallet ? (
        <div className="wallet-panel-message" role="alert">
          <p>Não foi possível consultar sua carteira.</p>
          <button type="button" onClick={() => void refetch()}>
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : (
        <>
          <div className="wallet-panel-balance">
            <span>SALDO DISPONÍVEL</span>
            <strong>{formatMoney(wallet.availableCents)}</strong>
          </div>

          <div className="wallet-panel-summary">
            <div>
              <span>SALDO TOTAL</span>
              <strong>{formatMoney(wallet.totalCents)}</strong>
            </div>

            <div>
              <span>RESERVADO EM LANCES</span>
              <strong>{formatMoney(wallet.committedCents)}</strong>
            </div>
          </div>
        </>
      )}

      <form className="wallet-panel-form" onSubmit={handleDeposit}>
        <label htmlFor="deposit-amount">ADICIONAR SALDO SIMULADO (R$)</label>

        <div className="wallet-panel-deposit">
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            placeholder="Ex.: 250,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={depositMutation.isPending}
            required
          />

          <button
            type="submit"
            disabled={depositMutation.isPending}
          >
            {depositMutation.isPending ? "..." : "DEPOSITAR"}
            <ArrowUpRight size={16} />
          </button>
        </div>

        {error && (
          <p className="wallet-panel-error" role="alert">{error}</p>
        )}

        {success && (
          <p className="wallet-panel-success" role="status">{success}</p>
        )}
      </form>

      <p className="wallet-panel-note">
        Ambiente de demonstração. Os valores são fictícios e não
        representam dinheiro real.
      </p>
    </section>
  );
}