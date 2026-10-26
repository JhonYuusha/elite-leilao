import { AlertTriangle, Gavel, X } from "lucide-react";

import type { ManagementAction } from "../../constants/auction";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  action: ManagementAction;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmActionModal({
  isOpen,
  title,
  action,
  isPending,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  if (!isOpen) {
    return null;
  }

  const isCancellation = action === "cancel";

  return (
    <div
      className="auctioneer-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div
        className="auctioneer-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auctioneer-modal-title"
        aria-describedby="auctioneer-modal-description"
      >
        <button
          type="button"
          className="auctioneer-modal-close"
          onClick={onClose}
          disabled={isPending}
          aria-label="Fechar confirmação"
        >
          <X size={20} />
        </button>

        <div className="auctioneer-modal-icon">
          {isCancellation ? (
            <AlertTriangle size={26} />
          ) : (
            <Gavel size={26} />
          )}
        </div>

        <span className="section-kicker">
          ÁUREO / CONFIRMAÇÃO
        </span>

        <h2 id="auctioneer-modal-title">
          {isCancellation
            ? "CANCELAR LOTE?"
            : "LIQUIDAR LEILÃO?"}
        </h2>

        <p id="auctioneer-modal-description">
          {isCancellation
            ? "Você está prestes a cancelar o lote abaixo. Esta ação não poderá ser desfeita."
            : "Você está prestes a encerrar financeiramente este leilão. O resultado e as movimentações serão registrados."}
        </p>

        <div className="auctioneer-modal-lot">
          <span>LOTE SELECIONADO</span>
          <strong>{title}</strong>
        </div>

        <div className="auctioneer-modal-actions">
          <button
            type="button"
            className="auctioneer-modal-back"
            onClick={onClose}
            disabled={isPending}
          >
            VOLTAR
          </button>

          <button
            type="button"
            className={
              isCancellation
                ? "auctioneer-modal-confirm danger"
                : "auctioneer-modal-confirm"
            }
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending
              ? "PROCESSANDO..."
              : isCancellation
                ? "CONFIRMAR CANCELAMENTO"
                : "CONFIRMAR LIQUIDAÇÃO"}
          </button>
        </div>
      </div>
    </div>
  );
}