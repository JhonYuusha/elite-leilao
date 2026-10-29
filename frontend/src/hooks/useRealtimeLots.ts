import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { socket } from "../lib/socket";

interface LotUpdatedEvent {
  lotId: string;
  currentBidCents: string;
  endsAt: string;
  status: "LIVE";
  extended: boolean;
}

export function useRealtimeLots(lotId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleLotUpdated = (event: LotUpdatedEvent) => {
      if (!lotId || event.lotId !== lotId) {
        return;
      }

      // Atualiza os dados principais do lote.
      void queryClient.invalidateQueries({
        queryKey: ["lot", event.lotId],
      });

      // Atualiza o histórico público de lances.
      void queryClient.invalidateQueries({
        queryKey: ["lot-bid-history", event.lotId],
      });

      // Atualiza a auditoria criptográfica pública.
      void queryClient.invalidateQueries({
        queryKey: ["lot-audit", event.lotId],
      });

      // Atualiza a posição privada do participante.
      void queryClient.invalidateQueries({
        queryKey: ["my-bids"],
      });
    };

    const handleLotsUpdated = () => {
      void queryClient.invalidateQueries({
        queryKey: ["lots"],
      });
    };

    const synchronize = () => {
      if (lotId) {
        socket.emit("lot:join", lotId);

        // Sincroniza o lote ao conectar ou reconectar.
        void queryClient.invalidateQueries({
          queryKey: ["lot", lotId],
        });

        void queryClient.invalidateQueries({
          queryKey: ["lot-bid-history", lotId],
        });

        void queryClient.invalidateQueries({
          queryKey: ["lot-audit", lotId],
        });

        void queryClient.invalidateQueries({
          queryKey: ["my-bids"],
        });
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["lots"],
        });
      }
    };

    socket.on("connect", synchronize);

    if (lotId) {
      socket.on("lot:updated", handleLotUpdated);
    } else {
      socket.on("lots:updated", handleLotsUpdated);
    }

    if (!socket.connected) {
      socket.connect();
    } else {
      synchronize();
    }

    return () => {
      if (lotId && socket.connected) {
        socket.emit("lot:leave", lotId);
      }

      socket.off("connect", synchronize);
      socket.off("lot:updated", handleLotUpdated);
      socket.off("lots:updated", handleLotsUpdated);
    };
  }, [lotId, queryClient]);
}