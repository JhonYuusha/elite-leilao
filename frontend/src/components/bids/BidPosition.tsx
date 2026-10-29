import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Trophy,
} from "lucide-react";

import { USER_ROLES } from "../../constants/auction";
import { useAuth } from "../../hooks/useAuth";
import { getMyBids } from "../../services/my-bids.service";
import { formatCents } from "../../utils/money";

interface BidPositionProps {
  lotId: string;
}

export function BidPosition({ lotId }: BidPositionProps) {
  const { user, isLoading } = useAuth();

  const isBidder = user?.role === USER_ROLES.BIDDER;

  const {
    data: lots,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["my-bids", user?.id],
    queryFn: getMyBids,
    enabled: !isLoading && isBidder,
    refetchInterval: 10000,
  });

  if (isLoading || !isBidder) {
    return null;
  }

  if (isPending) {
    return (
      <div className="auction-position" role="status">
        CONSULTANDO SUA POSIÇÃO...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="auction-position">
        Não foi possível consultar sua posição.
      </div>
    );
  }

  const participation = lots?.find(
    (lot) => lot.id === lotId,
  );

  if (!participation) {
    return (
      <div className="auction-position">
        <CircleAlert size={20} />

        <div>
          <strong>VOCÊ AINDA NÃO PARTICIPOU</strong>
          <p>
            Registre seu primeiro lance para acompanhar
            sua posição nesta disputa.
          </p>
        </div>
      </div>
    );
  }

  const isWon = participation.result === "WON";
  const isLeading =
    participation.result === "LEADING" ||
    participation.result === "PENDING_SETTLEMENT";

  const title = isWon
    ? "LOTE ARREMATADO POR VOCÊ"
    : participation.result === "LOST"
      ? "DISPUTA ENCERRADA"
      : participation.result === "PENDING_SETTLEMENT"
        ? "AGUARDANDO LIQUIDAÇÃO"
        : isLeading
          ? "VOCÊ ESTÁ LIDERANDO!"
          : "SEU LANCE FOI SUPERADO";

  const Icon = isWon
    ? Trophy
    : isLeading
      ? CheckCircle2
      : CircleAlert;

  return (
    <div
      className={[
        "auction-position",
        isWon || isLeading
          ? "auction-position-positive"
          : "auction-position-outbid",
      ].join(" ")}
      role="status"
    >
      <Icon size={23} />

      <div>
        <strong>{title}</strong>

        <p>
          Seu maior lance:{" "}
          <b>
            {formatCents(
              participation.myHighestBidCents,
            )}
          </b>
        </p>

        <small>
          {participation.myBidCount}{" "}
          {participation.myBidCount === 1
            ? "lance registrado"
            : "lances registrados"}
        </small>
      </div>
    </div>
  );
}
