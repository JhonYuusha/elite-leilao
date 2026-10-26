
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight, Gavel } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useNow } from "../hooks/useNow";
import { api } from "../lib/api";
import type { Lot } from "../types/lot";
import "./BidPanel.css";

function formatMoney(cents: bigint): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

export function BidPanel({ lot }: { lot: Lot }) {
  const { user } = useAuth();
  const now = useNow();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentBid = lot.currentBidCents
    ? BigInt(lot.currentBidCents)
    : null;

  const minimumBid = currentBid === null
    ? BigInt(lot.startingBidCents)
    : currentBid + BigInt(lot.minIncrementCents);

  const isLive =
    lot.status === "LIVE" &&
    now !== null &&
    now >= new Date(lot.startsAt).getTime() &&
    now < new Date(lot.endsAt).getTime();

  const mutation = useMutation({
    mutationFn: async (amountCents: string) => {
      const { data } = await api.post(`/lots/${lot.id}/bids`, {
        amountCents,
      });

      return data;
    },
    onSuccess: async () => {
      setAmount("");
      setError("");
      setSuccess("Lance registrado com sucesso!");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lot", lot.id] }),
        queryClient.invalidateQueries({ queryKey: ["lots"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
      ]);
    },
    onError: (err) => {
      setSuccess("");

      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.error;

        setError(
          typeof message === "string"
            ? message
            : "Não foi possível registrar o lance.",
        );
      } else {
        setError("Ocorreu um erro inesperado.");
      }

      void queryClient.invalidateQueries({
        queryKey: ["lot", lot.id],
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!isLive) {
      setError("Este lote não está disponível para novos lances.");
      return;
    }

    if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim())) {
      setError("Informe um valor válido, com até duas casas decimais.");
      return;
    }

    const [reais, centavos = ""] = amount
      .trim()
      .replace(",", ".")
      .split(".");

    const amountCents =
      BigInt(reais) * 100n +
      BigInt(centavos.padEnd(2, "0"));

    if (amountCents < minimumBid) {
      setError(`O lance mínimo é ${formatMoney(minimumBid)}.`);
      return;
    }

    if (amountCents > 9223372036854775807n) {
      setError("O valor informado ultrapassa o limite permitido.");
      return;
    }

    mutation.mutate(amountCents.toString());
  }

  return (
    <section className="bid-panel">
      <div className="bid-panel-heading">
        <Gavel size={22} />
        <span>PARTICIPE DA DISPUTA</span>
      </div>

      <div className="bid-panel-minimum">
        <span>PRÓXIMO LANCE MÍNIMO</span>
        <strong>{formatMoney(minimumBid)}</strong>
      </div>

      {!isLive ? (
        <p className="bid-panel-message">
          Este lote não está disponível para novos lances.
        </p>
      ) : !user ? (
        <div className="bid-panel-access">
          <p>Entre na sua conta para participar deste leilão.</p>

          <Link
            to="/login"
            state={{ from: `/lotes/${lot.id}` }}
          >
            ENTRAR PARA DAR UM LANCE
            <ArrowUpRight size={17} />
          </Link>
        </div>
      ) : user.role !== "BIDDER" ? (
        <p className="bid-panel-message">
          Contas de leiloeiro não podem participar das disputas.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bid-panel-form"
        >
          <label htmlFor="bid-amount">
            SEU LANCE (R$)
          </label>

          <input
            id="bid-amount"
            type="text"
            inputMode="decimal"
            placeholder="Ex.: 550,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={mutation.isPending}
            required
          />

          {error && (
            <p className="bid-panel-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="bid-panel-success" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "REGISTRANDO..."
              : "CONFIRMAR LANCE"}

            <ArrowUpRight size={19} />
          </button>

          <p className="bid-panel-note">
            O valor do lance será reservado na sua carteira
            simulada. Caso outro participante supere sua oferta,
            a reserva será liberada.
          </p>
        </form>
      )}
    </section>
  );
}