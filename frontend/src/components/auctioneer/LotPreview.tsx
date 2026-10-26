import { ImageOff } from "lucide-react";

import { toCents, formatCents } from "../../utils/money";

interface LotPreviewProps {
  mode: "manual" | "import";
  title: string;
  imageUrl: string;
  startingBid: string;
}

export function LotPreview({
  mode,
  title,
  imageUrl,
  startingBid,
}: LotPreviewProps) {
  const startingBidCents = toCents(startingBid);

  return (
    <aside className="auctioneer-preview">
      <span className="section-kicker">
        PRÉ-VISUALIZAÇÃO
      </span>

      <h2>SEU LOTE NO ÁUREO.</h2>

      <div className="auctioneer-preview-image">
        {imageUrl.trim() ? (
          <img
            src={imageUrl.trim()}
            alt="Prévia da imagem do lote"
          />
        ) : (
          <div>
            <ImageOff size={42} strokeWidth={1} />
            <span>IMAGEM DO PRODUTO</span>
          </div>
        )}
      </div>

      <div className="auctioneer-preview-content">
        <span>CATÁLOGO / NOVO LOTE</span>

        <h3>
          {mode === "manual"
            ? title.trim() || "NOME DO SEU PRODUTO"
            : "PRODUTO IMPORTADO"}
        </h3>

        <p>LANCE INICIAL</p>

        <strong>
          {startingBidCents
            ? formatCents(startingBidCents)
            : "R$ 0,00"}
        </strong>
      </div>

      <p className="auctioneer-preview-note">
        Esta é uma prévia ilustrativa. O lote publicado
        aparecerá no catálogo oficial da plataforma.
      </p>
    </aside>
  );
}