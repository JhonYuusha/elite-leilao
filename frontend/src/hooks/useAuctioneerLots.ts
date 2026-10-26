import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ManagementAction } from "../constants/auction";
import {
  getManagedLots,
  manageLot,
  apiErrorMessage,
} from "../services/lots.service";
import type { ManagedLot } from "../types/lot";

interface UseAuctioneerLotsOptions {
  enabled: boolean;
}

interface PendingAction {
  lot: ManagedLot;
  action: ManagementAction;
}

export function useAuctioneerLots({
  enabled,
}: UseAuctioneerLotsOptions) {
  const queryClient = useQueryClient();

  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const updateClock = () => {
      setNow(Date.now());
    };

    updateClock();

    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, [enabled]);

  const lotsQuery = useQuery({
    queryKey: ["lots", "mine"],
    queryFn: getManagedLots,
    enabled,
    refetchInterval: 15000,
  });

  const mutation = useMutation({
    mutationFn: ({
      lotId,
      action,
    }: {
      lotId: string;
      action: ManagementAction;
    }) => manageLot(lotId, action),

    onSuccess: async () => {
      setError("");

      await queryClient.invalidateQueries({
        queryKey: ["lots"],
      });

      setPendingAction(null);
    },

    onError: (err) => {
      setError(
        apiErrorMessage(
          err,
          "Não foi possível concluir a operação.",
        ),
      );
    },
  });

  function requestAction(
    lot: ManagedLot,
    action: ManagementAction,
  ) {
    if (mutation.isPending) {
      return;
    }

    setError("");
    setPendingAction({ lot, action });
  }

  function confirmAction() {
    if (!pendingAction || mutation.isPending) {
      return;
    }

    mutation.mutate({
      lotId: pendingAction.lot.id,
      action: pendingAction.action,
    });
  }

  function closeAction() {
    if (mutation.isPending) {
      return;
    }

    setPendingAction(null);
  }

  return {
    lotsQuery,
    now,
    error,
    pendingAction,
    pendingLotId: pendingAction?.lot.id ?? null,
    isMutating: mutation.isPending,
    requestAction,
    confirmAction,
    closeAction,
  };
}