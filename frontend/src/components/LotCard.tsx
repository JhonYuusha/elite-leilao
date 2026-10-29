import { ArrowUpRight, Clock3, ImageOff } from "lucide-react";
import { Link } from "react-router-dom";

import { getEffectiveLotStatus } from "../lib/lot-status";
import type { Lot } from "../types/lot";

interface LotCardProps {
  lot: Lot;
  now: number | null;
}

const statusLabels = {
  LIVE: "AO VIVO",
  SCHEDULED: "EM BREVE",
  ENDED: "ENCERRADO",
  CANCELLED: "CANCELADO",
} as const;

function formatMoney(cents: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

export function LotCard({ lot, now }: LotCardProps) {
  const status = getEffectiveLotStatus(lot, now);
  const price = lot.currentBidCents ?? lot.startingBidCents;

  if (status === "CANCELLED") return null;

  return (
    <Link className="lot-card" to={`/lotes/${lot.id}`}>
      <div className="lot-card__visual">
        {lot.imageUrl ? (
          <img src={lot.imageUrl} alt={lot.title} loading="lazy" />
        ) : (
          <div className="lot-card__placeholder">
            <ImageOff size={35} strokeWidth={1} />
            <span>SEM IMAGEM DISPONÍVEL</span>
          </div>
        )}

        <div className="lot-card__status">
          {status === "LIVE" && <span className="status-dot" />}
          {status ? statusLabels[status] : "VERIFICANDO"}
        </div>
      </div>

      <div className="lot-card__meta">
        <span>LOTE / {lot.id.slice(0, 8).toUpperCase()}</span>
        <ArrowUpRight size={19} />
      </div>

      <h3>{lot.title}</h3>

      <div className="lot-card__details">
        <div>
          <span className="lot-card__label">
            {lot.currentBidCents ? "LANCE ATUAL" : "LANCE INICIAL"}
          </span>
          <strong>{formatMoney(price)}</strong>
        </div>

        <div className="lot-card__time">
          <Clock3 size={15} />
          <span>
            {new Date(lot.endsAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}