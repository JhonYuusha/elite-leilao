import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { LotCard } from "../LotCard";
import {
  getEffectiveLotStatus,
  type PublicLotStatus,
} from "../../lib/lot-status";
import type { Lot } from "../../types/lot";

import "../../styles/components/LotCatalog.css";

interface LotCatalogProps {
  lots: Lot[];
  search: string;
  now: number | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const categories: {
  status: PublicLotStatus;
  label: string;
  description: string;
}[] = [
  {
    status: "LIVE",
    label: "AO VIVO",
    description: "Disputas abertas para novos lances.",
  },
  {
    status: "SCHEDULED",
    label: "AGENDADOS",
    description: "Lotes que começarão em breve.",
  },
  {
    status: "ENDED",
    label: "ENCERRADOS",
    description: "Disputas finalizadas, com histórico disponível.",
  },
];

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function LotCatalog({
  lots,
  search,
  now,
  isLoading,
  isError,
  onRetry,
}: LotCatalogProps) {
  const [activeStatus, setActiveStatus] =
    useState<PublicLotStatus>("LIVE");

  const { groupedLots, counts } = useMemo(() => {
    const grouped: Record<PublicLotStatus, Lot[]> = {
      LIVE: [],
      SCHEDULED: [],
      ENDED: [],
    };

    const term = normalizeSearch(search);

    for (const lot of lots) {
      const status = getEffectiveLotStatus(lot, now);

      if (!status || status === "CANCELLED") continue;
      if (!normalizeSearch(lot.title).includes(term)) continue;

      grouped[status].push(lot);
    }

    grouped.LIVE.sort(
      (a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt),
    );

    grouped.SCHEDULED.sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );

    grouped.ENDED.sort(
      (a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt),
    );

    return {
      groupedLots: grouped,
      counts: {
        LIVE: grouped.LIVE.length,
        SCHEDULED: grouped.SCHEDULED.length,
        ENDED: grouped.ENDED.length,
      },
    };
  }, [lots, search, now]);

  const visibleLots = groupedLots[activeStatus];
  const activeCategory = categories.find(
    (category) => category.status === activeStatus,
  )!;

  return (
    <section className="auctions-section" id="leiloes">
      <div className="section-topline">
        <span>01 / CATÁLOGO</span>
        <span>EXPLORE OS LOTES</span>
      </div>

      <div className="catalog-heading">
        <div>
          <span className="section-kicker">
            ACOMPANHE AS DISPUTAS
          </span>

          <h2>
            NOSSO CATÁLOGO<span>.</span>
          </h2>
        </div>

        <div className="catalog-heading__info">
          <span>
            {counts.LIVE + counts.SCHEDULED + counts.ENDED} RESULTADO(S)
          </span>
          <p>
            Explore as disputas ao vivo, os próximos leilões
            e os lotes já encerrados.
          </p>
        </div>
      </div>

      <div
        className="catalog-tabs"
        role="group"
        aria-label="Filtrar lotes por situação"
      >
        {categories.map((category) => (
          <button
            key={category.status}
            type="button"
            className={`catalog-tabs__button ${
              activeStatus === category.status
                ? "catalog-tabs__button--active"
                : ""
            }`}
            aria-pressed={activeStatus === category.status}
            onClick={() => setActiveStatus(category.status)}
          >
            <span>{category.label}</span>
            <span className="catalog-tabs__count">
              {counts[category.status]}
            </span>
          </button>
        ))}
      </div>

      <div className="catalog-category-heading">
        <div>
          <span className="catalog-category-heading__eyebrow">
            {activeStatus === "LIVE"
              ? "DISPUTAS EM ANDAMENTO"
              : activeStatus === "SCHEDULED"
                ? "PRÓXIMAS OPORTUNIDADES"
                : "HISTÓRICO DE LEILÕES"}
          </span>
          <h3>{activeCategory.label}</h3>
          <p>{activeCategory.description}</p>
        </div>

        <span className="catalog-category-heading__total">
          {visibleLots.length}{" "}
          {visibleLots.length === 1 ? "LOTE" : "LOTES"}
        </span>
      </div>

      {isLoading || now === null ? (
        <div className="catalog-message" role="status">
          CARREGANDO CATÁLOGO...
        </div>
      ) : isError ? (
        <div className="catalog-message" role="alert">
          <p>NÃO FOI POSSÍVEL CARREGAR OS LOTES.</p>
          <button type="button" onClick={onRetry}>
            TENTAR NOVAMENTE <ArrowRight size={16} />
          </button>
        </div>
      ) : visibleLots.length === 0 ? (
        <div className="catalog-message">
          {search.trim()
            ? "NENHUM LOTE ENCONTRADO NESTA CATEGORIA."
            : activeStatus === "LIVE"
              ? "NENHUM LEILÃO AO VIVO NO MOMENTO."
              : activeStatus === "SCHEDULED"
                ? "NENHUM LEILÃO AGENDADO NO MOMENTO."
                : "AINDA NÃO HÁ LEILÕES ENCERRADOS."}
        </div>
      ) : (
        <div className="lots-grid">
          {visibleLots.map((lot) => (
            <LotCard key={lot.id} lot={lot} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
