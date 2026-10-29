import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AccountMenu } from "../components/AccountMenu";
import { CopyReceiptLink } from "../components/receipts/CopyReceiptLink";
import { ReceiptCard } from "../components/receipts/ReceiptCard";
import { ROUTES } from "../constants/routes";
import { getPublicReceipt } from "../services/receipts.service";

import "../styles/components/PublicReceipt.css";

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

export function PublicReceipt() {
  const { token } = useParams<{ token: string }>();

  const validToken =
    typeof token === "string" &&
    TOKEN_PATTERN.test(token);

  const {
    data: receipt,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-receipt", token],
    queryFn: () => getPublicReceipt(token!),
    enabled: validToken,
    retry: false,
  });

  return (
    <div className="public-receipt-page">
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

      <main className="public-receipt-main">
        <div className="public-receipt-topline">
          <span>ÁUREO / REGISTROS PÚBLICOS</span>
          <span>COMPROVANTE DE ARREMATE</span>
        </div>

        <div className="public-receipt-heading">
          <span className="section-kicker">
            TRANSPARÊNCIA
          </span>

          <h1>
            COMPROVANTE<span>.</span>
          </h1>

          <p>
            Consulte os dados públicos de um arremate
            concluído na plataforma.
          </p>
        </div>

        {!validToken ? (
          <div
            className="public-receipt-message"
            role="alert"
          >
            <ReceiptText size={30} />

            <h2>LINK INVÁLIDO.</h2>

            <p>
              O endereço informado não corresponde
              a um token de comprovante válido.
            </p>
          </div>
        ) : isPending ? (
          <div
            className="public-receipt-message"
            role="status"
          >
            CONSULTANDO COMPROVANTE...
          </div>
        ) : isError || !receipt ? (
          <div
            className="public-receipt-message"
            role="alert"
          >
            <ReceiptText size={30} />

            <h2>COMPROVANTE INDISPONÍVEL.</h2>

            <p>
              Não foi possível localizar ou consultar
              este registro.
            </p>

            <button
              type="button"
              onClick={() => void refetch()}
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <>
            <ReceiptCard receipt={receipt} />

            <div className="public-receipt-share">
              <p>
                Este endereço pode ser compartilhado
                para consulta pública do comprovante.
              </p>

              <CopyReceiptLink />
            </div>
          </>
        )}
      </main>
    </div>
  );
}