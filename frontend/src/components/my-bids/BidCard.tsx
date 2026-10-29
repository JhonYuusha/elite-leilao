import {
  ArrowUpRight,
  Gavel,
  ReceiptText,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  lotDetailsPath,
  publicReceiptPath,
} from "../../constants/routes";
import type { MyBidLot } from "../../types/my-bids";

interface BidCardProps {
  lot: MyBidLot;
}

const resultLabels: Record<MyBidLot["result"], string> = {
  WON: "ARREMATADO",
  LOST: "NÃO ARREMATADO",
  LEADING: "VOCÊ ESTÁ LIDERANDO",
  OUTBID: "LANCE SUPERADO",
  PENDING_SETTLEMENT: "AGUARDANDO LIQUIDAÇÃO",
};

function formatMoney(cents: string | null): string {
  if (cents === null) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BidCard({ lot }: BidCardProps) {
  return (
    <article className="my-bids-card">
      <div className="my-bids-card-image">
        {lot.imageUrl ? (
          <img src={lot.imageUrl} alt={lot.title} />
        ) : (
          <Gavel size={36} />
        )}
      </div>

      <div className="my-bids-card-body">
        <span
          className={`my-bids-status status-${lot.result.toLowerCase()}`}
        >
          {resultLabels[lot.result]}
        </span>

        <h3>{lot.title}</h3>

        <div className="my-bids-values">
          <div>
            <span>SEU MAIOR LANCE</span>
            <strong>
              {formatMoney(lot.myHighestBidCents)}
            </strong>
          </div>

          <div>
            <span>LANCE ATUAL</span>
            <strong>
              {formatMoney(lot.currentBidCents)}
            </strong>
          </div>

          <div>
            <span>QUANTIDADE DE LANCES</span>
            <strong>{lot.myBidCount}</strong>
          </div>

          <div>
            <span>ENCERRAMENTO</span>
            <strong>{formatDate(lot.endsAt)}</strong>
          </div>
        </div>

        {lot.isWinner && lot.settlement && (
          <p className="my-bids-winner-note">
            <Trophy size={16} />
            Arrematado por{" "}
            {formatMoney(lot.settlement.amountCents)}
          </p>
        )}

        <div className="my-bids-actions">
          <Link to={lotDetailsPath(lot.id)}>
            VER LOTE
            <ArrowUpRight size={15} />
          </Link>

          {lot.isWinner && lot.receiptToken && (
            <Link
              to={publicReceiptPath(lot.receiptToken)}
              className="my-bids-receipt"
            >
              <ReceiptText size={15} />
              COMPROVANTE
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}