
import { ArrowLeft, ArrowUpRight, Clock3, ImageOff } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AccountMenu } from "../components/AccountMenu";
import { BidPanel } from "../components/BidPanel";
import { WalletPanel } from "../components/WalletPanel";
import { useLot } from "../hooks/useLot";
import { useNow } from "../hooks/useNow";
import type { Lot } from "../types/lot";

function formatMoney(cents: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

function getStatus(lot: Lot, now: number | null) {
  if (lot.status === "ENDED") return "ENCERRADO";
  if (now === null) return "VERIFICANDO";

  const starts = new Date(lot.startsAt).getTime();
  const ends = new Date(lot.endsAt).getTime();

  if (now >= ends) return "ENCERRADO";
  if (now < starts || lot.status === "SCHEDULED") return "EM BREVE";

  return lot.status === "LIVE" ? "AO VIVO" : "VERIFICANDO";
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function LotDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: lot, isLoading, isError, refetch } = useLot(id);
  const now = useNow();

  return (
    <div className="detail-page">
      <header className="site-header">
        <Link to="/" className="brand">
          ÁUREO<span>.</span>
        </Link>

        <div className="detail-header-actions">
          <Link to="/#leiloes" className="header-action">
            <ArrowLeft size={16} />
            VOLTAR AO CATÁLOGO
          </Link>

          <AccountMenu />
        </div>
      </header>

      <main className="detail-main">
        <Link to="/#leiloes" className="detail-back">
          <ArrowLeft size={17} />
          VOLTAR AOS LOTES
        </Link>

        {isLoading ? (
          <div className="detail-message" role="status">
            CARREGANDO LOTE...
          </div>
        ) : isError || !lot ? (
          <div className="detail-message" role="alert">
            <h1>LOTE INDISPONÍVEL.</h1>
            <p>Não foi possível encontrar os dados deste lote.</p>
            <button type="button" onClick={() => void refetch()}>
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <>
            <div className="detail-topline">
              <span>CATÁLOGO / LOTE {lot.id.slice(0, 8).toUpperCase()}</span>
              <span>{getStatus(lot, now)}</span>
            </div>

            <div className="detail-grid">
              <div className="detail-visual">
                {lot.imageUrl ? (
                  <img src={lot.imageUrl} alt={lot.title} />
                ) : (
                  <div className="detail-placeholder">
                    <ImageOff size={45} strokeWidth={1} />
                    <span>IMAGEM NÃO DISPONÍVEL</span>
                  </div>
                )}
              </div>

              <div className="detail-content">
                <span className="section-kicker">
                  LOTE {lot.id.slice(0, 8).toUpperCase()}
                </span>

                <h1>{lot.title}</h1>

                <p className="detail-description">
                  {lot.description || "Este lote não possui descrição adicional."}
                </p>

                <div className="detail-price">
                  <span>
                    {lot.currentBidCents ? "LANCE ATUAL" : "LANCE INICIAL"}
                  </span>

                  <strong>
                    {formatMoney(
                      lot.currentBidCents ?? lot.startingBidCents,
                    )}
                  </strong>
                </div>

                <div className="detail-facts">
                  <div>
                    <span>INCREMENTO MÍNIMO</span>
                    <strong>{formatMoney(lot.minIncrementCents)}</strong>
                  </div>

                  <div>
                    <span>INÍCIO</span>
                    <strong>{formatDate(lot.startsAt)}</strong>
                  </div>

                  <div>
                    <span>ENCERRAMENTO PREVISTO</span>
                    <strong>{formatDate(lot.endsAt)}</strong>
                  </div>
                </div>

                <WalletPanel />

                <BidPanel lot={lot} />

                <div className="detail-notice">
                  <Clock3 size={19} />

                  <p>
                    Os lances são registrados com segurança e o saldo
                    correspondente fica reservado na carteira do participante.
                    Se outro usuário superar a oferta, a reserva anterior
                    será liberada. Os valores são atualizados periodicamente,
                    e o prazo do leilão pode ser prorrogado conforme as regras
                    da plataforma.
                  </p>
                </div>

                <Link to="/#leiloes" className="detail-action">
                  EXPLORAR OUTROS LOTES
                  <ArrowUpRight size={20} />
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}