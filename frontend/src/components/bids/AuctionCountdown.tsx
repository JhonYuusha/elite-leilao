import { Clock3 } from "lucide-react";

import { useNow } from "../../hooks/useNow";
import type { Lot } from "../../types/lot";

interface AuctionCountdownProps {
  lot: Lot;
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function AuctionCountdown({
  lot,
}: AuctionCountdownProps) {
  const now = useNow();

  const startsAt = new Date(lot.startsAt).getTime();
  const endsAt = new Date(lot.endsAt).getTime();

  let label = "CONSULTANDO HORÁRIO";
  let remaining = "--:--:--";
  let state = "checking";

  if (lot.status === "CANCELLED") {
    label = "LEILÃO CANCELADO";
    remaining = "—";
    state = "ended";
  } else if (now !== null) {
    if (lot.status === "ENDED" || now >= endsAt) {
      label = "PRAZO ENCERRADO";
      remaining = "00:00:00";
      state = "ended";
    } else if (now < startsAt) {
      label = "INÍCIO EM";
      remaining = formatRemaining(startsAt - now);
      state = "scheduled";
    } else {
      label = "ENCERRA EM";
      remaining = formatRemaining(endsAt - now);
      state = endsAt - now <= 120000
        ? "urgent"
        : "live";
    }
  }

  return (
    <section
      className={`auction-countdown auction-countdown-${state}`}
      aria-label="Contagem regressiva do leilão"
    >
      <div className="auction-countdown-heading">
        <Clock3 size={19} />
        <span>{label}</span>
      </div>

      <strong className="auction-countdown-time">
        {remaining}
      </strong>

      <p>
        Lances aceitos nos últimos dois minutos
        podem prorrogar o encerramento.
      </p>
    </section>
  );
}
