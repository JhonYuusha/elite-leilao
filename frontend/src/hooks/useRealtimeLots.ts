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

      void queryClient.invalidateQueries({
        queryKey: ["lot", event.lotId],
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

        void queryClient.invalidateQueries({
          queryKey: ["lot", lotId],
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