import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Gavel,
  ImageOff,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  LOT_FILTERS,
  LOT_STATUS,
  LOT_STATUS_LABELS,
} from "../../constants/auction";
import type {
  LotFilter,
  ManagementAction,
} from "../../constants/auction";
import { useAuctioneerLots } from "../../hooks/useAuctioneerLots";
import type { ManagedLot } from "../../types/lot";
import {
  canCancelLot,
  canSettleLot,
  effectiveStatus,
  formatDate,
  totalReceivedCents,
} from "../../utils/auction";
import { formatCents } from "../../utils/money";
import { ConfirmActionModal } from "./ConfirmActionModal";

interface ManagedLotsProps {
  enabled: boolean;
}

interface ManagedLotCardProps {
  lot: ManagedLot;
  now: number;
  isMutating: boolean;
  pendingLotId: string | null;
  onAction: (
    lot: ManagedLot,
    action: ManagementAction,
  ) => void;
}

function ManagedLotCard({
  lot,
  now,
  isMutating,
  pendingLotId,
  onAction,
}: ManagedLotCardProps) {
  const status = effectiveStatus(lot, now);
  const busy = isMutating && pendingLotId === lot.id;

  return (
    <article className="auctioneer-lot-card">
      <div className="auctioneer-lot-image">
        {lot.imageUrl ? (
          <img
            src={lot.imageUrl}
            alt={lot.title}
            loading="lazy"
          />
        ) : (
          <ImageOff size={30} />
        )}
      </div>

      <div className="auctioneer-lot-content">
        <span
          className={`auctioneer-lot-status status-${status.toLowerCase()}`}
        >
          {LOT_STATUS_LABELS[status]}
        </span>

        <h3>{lot.title}</h3>

        <div className="auctioneer-lot-values">
          <div>
            <span>
              {lot.currentBidCents === null
                ? "LANCE INICIAL"
                : "LANCE ATUAL"}
            </span>

            <strong>
              {formatCents(
                lot.currentBidCents ??
                  lot.startingBidCents,
              )}
            </strong>
          </div>

          <div>
            <span>ENCERRAMENTO</span>
            <strong>{formatDate(lot.endsAt)}</strong>
          </div>
        </div>

        {lot.settlement && (
          <p className="auctioneer-lot-result">
            <CheckCircle2 size={15} />

            {lot.settlement.amountCents !== null
              ? `ARREMATADO POR ${formatCents(
                  lot.settlement.amountCents,
                )}`
              : "ENCERRADO SEM ARREMATE"}
          </p>
        )}

        <div className="auctioneer-lot-actions">
          {status !== LOT_STATUS.CANCELLED && (
            <Link to={`/lotes/${lot.id}`}>
              VER LOTE
              <ExternalLink size={14} />
            </Link>
          )}

          {canCancelLot(lot, now) && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onAction(lot, "cancel")}
            >
              <XCircle size={15} />
              {busy ? "PROCESSANDO..." : "CANCELAR"}
            </button>
          )}

          {canSettleLot(lot, now) && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onAction(lot, "settle")}
            >
              <Gavel size={15} />
              {busy ? "PROCESSANDO..." : "LIQUIDAR"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ManagedLots({ enabled }: ManagedLotsProps) {
  const [filter, setFilter] = useState<LotFilter>("ALL");

  const {
    lotsQuery,
    now,
    error,
    pendingAction,
    pendingLotId,
    isMutating,
    requestAction,
    confirmAction,
    closeAction,
  } = useAuctioneerLots({ enabled });

  const lots = lotsQuery.data ?? [];

  const settledLots = lots.filter(
    (lot) => lot.settlement?.amountCents != null,
  );

  const liveLots = lots.filter(
    (lot) => effectiveStatus(lot, now) === LOT_STATUS.LIVE,
  );

  const visibleLots = lots.filter(
    (lot) =>
      filter === "ALL" ||
      effectiveStatus(lot, now) === filter,
  );

  return (
    <section
      className="auctioneer-management"
      aria-labelledby="managed-lots-title"
    >
      <div className="auctioneer-management-heading">
        <div>
          <span className="section-kicker">
            CONTROLE E RESULTADOS
          </span>

          <h2 id="managed-lots-title">
            MEUS LEILÕES<span>.</span>
          </h2>

          <p>
            Gerencie seus lotes, acompanhe os resultados
            e consulte os valores recebidos.
          </p>
        </div>

        <button
          type="button"
          className="auctioneer-refresh"
          onClick={() => void lotsQuery.refetch()}
          disabled={lotsQuery.isFetching}
        >
          <RefreshCw size={16} />

          {lotsQuery.isFetching
            ? "ATUALIZANDO..."
            : "ATUALIZAR"}
        </button>
      </div>

      <div className="auctioneer-stats">
        <div>
          <span>LOTES CADASTRADOS</span>
          <strong>{lots.length}</strong>
        </div>

        <div>
          <span>EM DISPUTA</span>
          <strong>{liveLots.length}</strong>
        </div>

        <div>
          <span>ARREMATADOS</span>
          <strong>{settledLots.length}</strong>
        </div>

        <div>
          <span>TOTAL RECEBIDO</span>
          <strong>
            {formatCents(totalReceivedCents(lots))}
          </strong>
        </div>
      </div>

      <div
        className="auctioneer-filters"
        aria-label="Filtrar leilões"
      >
        {LOT_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              filter === option.value ? "active" : ""
            }
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="auctioneer-error" role="alert">
          {error}
        </p>
      )}

      {lotsQuery.isLoading ? (
        <p
          className="auctioneer-management-message"
          role="status"
        >
          CARREGANDO SEUS LEILÕES...
        </p>
      ) : lotsQuery.isError ? (
        <div
          className="auctioneer-management-message"
          role="alert"
        >
          Não foi possível consultar seus leilões.

          <button
            type="button"
            onClick={() => void lotsQuery.refetch()}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : visibleLots.length === 0 ? (
        <p className="auctioneer-management-message">
          NENHUM LOTE ENCONTRADO NESTA CATEGORIA.
        </p>
      ) : (
        <div className="auctioneer-lot-grid">
          {visibleLots.map((lot) => (
            <ManagedLotCard
              key={lot.id}
              lot={lot}
              now={now}
              isMutating={isMutating}
              pendingLotId={pendingLotId}
              onAction={requestAction}
            />
          ))}
        </div>
      )}

      <ConfirmActionModal
        isOpen={pendingAction !== null}
        title={pendingAction?.lot.title ?? ""}
        action={pendingAction?.action ?? "settle"}
        isPending={isMutating}
        onConfirm={confirmAction}
        onClose={closeAction}
      />
    </section>
  );
}