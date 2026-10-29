import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useLotAudit } from "../../hooks/useLotAudit";
import { formatCents } from "../../utils/money";

import "../../styles/components/LotAudit.css";

interface LotAuditProps {
  lotId: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function LotAudit({ lotId }: LotAuditProps) {
  const {
    data: audit,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useLotAudit(lotId);

  return (
    <section
      className="lot-audit"
      aria-labelledby="lot-audit-title"
    >
      <header className="lot-audit-header">
        <div className="lot-audit-heading">
          <ShieldCheck size={24} aria-hidden="true" />

          <div>
            <span>TRANSPARÊNCIA ÁUREO</span>
            <h2 id="lot-audit-title">
              AUDITORIA PÚBLICA
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="lot-audit-refresh"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Atualizar auditoria"
          title="Atualizar auditoria"
        >
          <RefreshCw
            size={17}
            className={isFetching ? "is-spinning" : ""}
          />
        </button>
      </header>

      {isPending ? (
        <p className="lot-audit-feedback" role="status">
          Verificando a integridade dos registros...
        </p>
      ) : isError || !audit ? (
        <div className="lot-audit-feedback" role="alert">
          <p>
            Não foi possível consultar a auditoria
            deste lote.
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
          <div
            className={[
              "lot-audit-result",
              audit.integrity.valid
                ? "lot-audit-result-valid"
                : "lot-audit-result-invalid",
            ].join(" ")}
            role="status"
          >
            {audit.integrity.valid ? (
              <CheckCircle2
                size={25}
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                size={25}
                aria-hidden="true"
              />
            )}

            <div>
              <strong>
                {audit.integrity.valid
                  ? "CADEIA DE LANCES CONSISTENTE"
                  : "INCONSISTÊNCIA DETECTADA"}
              </strong>

              <p>
                {audit.integrity.valid
                  ? `${audit.integrity.checkedBids} registro(s) verificado(s) sem inconsistências detectadas.`
                  : "A verificação encontrou problemas nos registros deste lote."}
              </p>
            </div>
          </div>

          <div className="lot-audit-stats">
            <div>
              <span>LANCES REGISTRADOS</span>
              <strong>{audit.totalBids}</strong>
            </div>

            <div>
              <span>REGISTROS VERIFICADOS</span>
              <strong>
                {audit.integrity.checkedBids}
              </strong>
            </div>

            <div>
              <span>VALOR ATUAL</span>
              <strong>
                {audit.currentBidCents === null
                  ? "Sem lances"
                  : formatCents(audit.currentBidCents)}
              </strong>
            </div>
          </div>

          {audit.integrity.issues.length > 0 && (
            <div className="lot-audit-issues">
              <h3>PROBLEMAS IDENTIFICADOS</h3>

              <ul>
                {audit.integrity.issues.map(
                  (issue, index) => (
                    <li key={`${index}-${issue}`}>
                      {issue}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          <div className="lot-audit-chain">
            <div className="lot-audit-chain-heading">
              <Fingerprint
                size={19}
                aria-hidden="true"
              />
              <h3>REGISTROS CRIPTOGRÁFICOS</h3>
            </div>

            {audit.bids.length === 0 ? (
              <p className="lot-audit-empty">
                Ainda não existem lances para auditar.
              </p>
            ) : (
              <ol className="lot-audit-list">
                {audit.bids.map((bid, index) => (
                  <li
                    key={bid.id}
                    className="lot-audit-entry"
                  >
                    <div className="lot-audit-entry-top">
                      <strong>
                        LANCE #{index + 1}
                      </strong>

                      <time dateTime={bid.createdAt}>
                        {formatDate(bid.createdAt)}
                      </time>
                    </div>

                    <p className="lot-audit-bidder">
                      {bid.bidderAlias}
                    </p>

                    <p className="lot-audit-amount">
                      {formatCents(bid.amountCents)}
                    </p>

                    <div className="lot-audit-hash">
                      <span>HASH SHA-256</span>
                      <code>{bid.hash}</code>
                    </div>

                    <div className="lot-audit-hash">
                      <span>HASH ANTERIOR</span>
                      <code>
                        {bid.previousHash ?? "GÊNESE"}
                      </code>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="lot-audit-disclaimer">
            A auditoria recalcula os hashes SHA-256
            e verifica a consistência dos elos da
            cadeia. Ela detecta alterações
            inconsistentes nos registros, mas não
            constitui prova contra a reescrita
            completa da cadeia por alguém com acesso
            privilegiado ao banco de dados.
          </p>
        </>
      )}
    </section>
  );
}
