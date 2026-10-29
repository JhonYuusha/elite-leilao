import { CheckCircle2, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";

import { lotDetailsPath } from "../../constants/routes";
import type { PublicReceiptData } from "../../types/receipt";

interface ReceiptCardProps {
  receipt: PublicReceiptData;
}

function formatMoney(cents: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReceiptCard({ receipt }: ReceiptCardProps) {
  return (
    <article className="receipt-card">
      <div className="receipt-card-heading">
        <div className="receipt-card-icon">
          <ReceiptText size={28} strokeWidth={1.5} />
        </div>

        <span>COMPROVANTE PÚBLICO</span>
        <h2>ARREMATE CONFIRMADO.</h2>

        <p>
          Registro de um leilão liquidado na plataforma
          ÁUREO.
        </p>
      </div>

      <div className="receipt-card-status">
        <CheckCircle2 size={18} />
        <span>LIQUIDAÇÃO CONCLUÍDA</span>
      </div>

      <dl className="receipt-card-details">
        <div>
          <dt>LOTE ARREMATADO</dt>
          <dd>{receipt.lotTitle}</dd>
        </div>

        <div>
          <dt>IDENTIFICAÇÃO DO VENCEDOR</dt>
          <dd>{receipt.winnerAlias}</dd>
        </div>

        <div>
          <dt>VALOR DO ARREMATE</dt>
          <dd className="receipt-card-amount">
            {formatMoney(receipt.amountCents)}
          </dd>
        </div>

        <div>
          <dt>DATA DE EMISSÃO</dt>
          <dd>{formatDate(receipt.issuedAt)}</dd>
        </div>

        <div>
          <dt>IDENTIFICADOR DO COMPROVANTE</dt>
          <dd className="receipt-card-id">
            {receipt.id}
          </dd>
        </div>
      </dl>

      <div className="receipt-card-footer">
        <p>
          Este comprovante registra uma operação com
          saldo simulado. Não representa transferência
          bancária ou pagamento em moeda real.
        </p>

        <Link to={lotDetailsPath(receipt.lotId)}>
          CONSULTAR LOTE
        </Link>
      </div>
    </article>
  );
}
