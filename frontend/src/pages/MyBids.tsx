import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gavel } from "lucide-react";
import { Link } from "react-router-dom";

import { AccountMenu } from "../components/AccountMenu";
import { BidCard } from "../components/my-bids/BidCard";
import { USER_ROLES } from "../constants/auction";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { useNow } from "../hooks/useNow";
import { getMyBids } from "../services/my-bids.service";

import "../styles/components/MyBids.css";

type Filter = "ALL" | "WON" | "ACTIVE";

const filters: ReadonlyArray<{
  value: Filter;
  label: string;
}> = [
  { value: "ALL", label: "TODOS" },
  { value: "ACTIVE", label: "EM DISPUTA" },
  { value: "WON", label: "ARREMATADOS" },
];

export function MyBids() {
  const { user, isLoading } = useAuth();

  const [filter, setFilter] = useState<Filter>("ALL");

  const now = useNow();

  const isBidder = user?.role === USER_ROLES.BIDDER;

  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["my-bids", user?.id],
    queryFn: getMyBids,
    enabled: !isLoading && isBidder,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <main className="my-bids-state" role="status">
        VERIFICANDO ACESSO...
      </main>
    );
  }

  if (!isBidder) {
    return (
      <main className="my-bids-state">
        <Gavel size={32} />

        <h1>ACESSO RESTRITO.</h1>

        <p>
          Entre com uma conta de participante para
          consultar seus arremates.
        </p>

        <Link to={user ? ROUTES.HOME : ROUTES.LOGIN}>
          VOLTAR
        </Link>
      </main>
    );
  }

  const lots = data ?? [];

  const isActiveLot = (endsAt: string): boolean => {
  if (now === null) {
    return false;
  }

  return new Date(endsAt).getTime() > now;
};

  const filtered = lots.filter((lot) => {
    switch (filter) {
      case "WON":
        return lot.isWinner;

      case "ACTIVE":
        return (
          isActiveLot(lot.endsAt) &&
          (
            lot.result === "LEADING" ||
            lot.result === "OUTBID"
          )
        );

      case "ALL":
      default:
        return true;
    }
  });

  const wonCount = lots.filter(
    (lot) => lot.isWinner,
  ).length;

  const leadingCount = lots.filter(
    (lot) =>
      lot.result === "LEADING" &&
      isActiveLot(lot.endsAt),
  ).length;

  return (
    <div className="my-bids-page">
      <header className="site-header">
        <Link
          to={ROUTES.HOME}
          className="brand"
        >
          ÁUREO<span>.</span>
        </Link>

        <div className="detail-header-actions">
          <Link
            to={ROUTES.HOME}
            className="header-action"
          >
            <ArrowLeft size={16} />
            CATÁLOGO
          </Link>

          <AccountMenu />
        </div>
      </header>

      <main className="my-bids-main">
        <div className="my-bids-topline">
          <span>ÁUREO / PARTICIPANTE</span>
          <span>HISTÓRICO DE PARTICIPAÇÕES</span>
        </div>

        <div className="my-bids-heading">
          <span className="section-kicker">
            SUA ATIVIDADE NOS LEILÕES
          </span>

          <h1>
            MEUS ARREMATES<span>.</span>
          </h1>

          <p>
            Acompanhe seus lances, consulte os lotes
            conquistados e acesse seus comprovantes.
          </p>
        </div>

        <div className="my-bids-stats">
          <div>
            <span>LOTES PARTICIPADOS</span>
            <strong>{lots.length}</strong>
          </div>

          <div>
            <span>ARREMATES CONCLUÍDOS</span>
            <strong>{wonCount}</strong>
          </div>

          <div>
            <span>LIDERANDO</span>
            <strong>{leadingCount}</strong>
          </div>
        </div>

        <div className="my-bids-toolbar">
          <div className="my-bids-filters">
            {filters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={
                  filter === value ? "active" : ""
                }
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="my-bids-refresh"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching
              ? "ATUALIZANDO..."
              : "ATUALIZAR"}
          </button>
        </div>

        {isPending ? (
          <div
            className="my-bids-message"
            role="status"
          >
            CARREGANDO SEUS ARREMATES...
          </div>
        ) : isError ? (
          <div
            className="my-bids-message"
            role="alert"
          >
            Não foi possível consultar seus arremates.

            <button
              type="button"
              onClick={() => void refetch()}
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="my-bids-message">
            Nenhum lote encontrado neste filtro.

            <p>
              Explore o catálogo e participe de um leilão!
            </p>

            <Link to={ROUTES.HOME}>
              EXPLORAR CATÁLOGO
            </Link>
          </div>
        ) : (
          <div className="my-bids-grid">
            {filtered.map((lot) => (
              <BidCard
                key={lot.id}
                lot={lot}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}