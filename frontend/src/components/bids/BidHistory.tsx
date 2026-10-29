import { History, ShieldCheck } from "lucide-react";

import { useLotBidHistory } from "../../hooks/useLotBidHistory";
import { formatCents } from "../../utils/money";

interface BidHistoryProps {
  lotId: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function BidHistory({ lotId }: BidHistoryProps) {
  const {
    data: history,
    isPending,
    isError,
    refetch,
  } = useLotBidHistory(lotId);

  return (
    <section className="auction-bid-history">
      <div className="auction-section-heading">
        <History size={20} />

        <div>
          <span>REGISTRO PÚBLICO</span>
          <h2>HISTÓRICO DE LANCES</h2>
        </div>
      </div>

      {isPending ? (
        <p className="auction-feedback" role="status">
          Carregando histórico...
        </p>
      ) : isError || !history ? (
        <div className="auction-feedback" role="alert">
          <p>Não foi possível carregar os lances.</p>

          <button
            type="button"
            onClick={() => void refetch()}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : history.totalBids === 0 ? (
        <p className="auction-feedback">
          Nenhum lance registrado. A disputa ainda
          está aguardando a primeira oferta.
        </p>
      ) : (
        <>
          <div className="auction-history-summary">
            <span>
              {history.totalBids}{" "}
              {history.totalBids === 1 ? "LANCE" : "LANCES"}
            </span>

            <span>MAIS RECENTE PRIMEIRO</span>
          </div>

          <ol className="auction-history-list">
            {[...history.bids].reverse().map((bid, index) => (
              <li
                key={bid.id}
                className={
                  index === 0
                    ? "auction-history-entry is-leading"
                    : "auction-history-entry"
                }
              >
                <div className="auction-history-entry-top">
                  <strong>{bid.bidderAlias}</strong>

                  {index === 0 && (
                    <span className="auction-history-leader">
                      MAIOR LANCE
                    </span>
                  )}
                </div>

                <strong className="auction-history-value">
                  {formatCents(bid.amountCents)}
                </strong>

                <div className="auction-history-entry-bottom">
                  <time dateTime={bid.createdAt}>
                    {formatDate(bid.createdAt)}
                  </time>

                  <span>LANCE #{bid.position}</span>
                </div>
              </li>
            ))}
          </ol>

          <p className="auction-history-note">
            <ShieldCheck size={15} />
            Os registros possuem hashes encadeados.
            A verificação da integridade será disponibilizada
            na auditoria pública.
          </p>
        </>
      )}
    </section>
  );
}
