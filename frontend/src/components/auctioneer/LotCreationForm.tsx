import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, PackagePlus } from "lucide-react";

import {
  apiErrorMessage,
  createLot,
} from "../../services/lots.service";
import type { ExternalProduct } from "../../services/product-search.service";
import { toIso } from "../../utils/auction";
import { toCents } from "../../utils/money";
import { LotPreview } from "./LotPreview";
import { ProductSearch } from "./ProductSearch";

type CreationMode = "manual" | "import";

export function LotCreationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<CreationMode>("manual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ExternalProduct | null>(null);
  const [startingBid, setStartingBid] = useState("");
  const [minIncrement, setMinIncrement] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createLot,

    onSuccess: async (lot) => {
      await queryClient.invalidateQueries({
        queryKey: ["lots"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["auctioneer-lots"],
      });

      navigate(`/lotes/${lot.id}`);
    },

    onError: (err) => {
      setError(
        apiErrorMessage(
          err,
          "Não foi possível criar o lote.",
        ),
      );
    },
  });

  function changeMode(nextMode: CreationMode) {
    if (createMutation.isPending) return;

    setMode(nextMode);
    setSelectedProduct(null);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (createMutation.isPending) return;

    const startingBidCents = toCents(startingBid);
    const minIncrementCents = toCents(minIncrement);
    const startIso = toIso(startsAt);
    const endIso = toIso(endsAt);

    if (!startingBidCents || !minIncrementCents) {
      setError("Informe valores monetários positivos e válidos.");
      return;
    }

    if (!startIso || !endIso) {
      setError("Informe datas de início e encerramento válidas.");
      return;
    }

    if (Date.parse(endIso) <= Date.parse(startIso)) {
      setError("O encerramento precisa ser posterior ao início.");
      return;
    }

    if (Date.parse(endIso) <= Date.now()) {
      setError("O encerramento precisa estar no futuro.");
      return;
    }

    const common = {
      startingBidCents,
      minIncrementCents,
      startsAt: startIso,
      endsAt: endIso,
    };

    if (mode === "import") {
      if (!selectedProduct) {
        setError("Selecione um produto do catálogo externo.");
        return;
      }

      createMutation.mutate({
        ...common,
        sourceItemId: selectedProduct.id,
        ...(imageUrl.trim()
          ? { imageUrl: imageUrl.trim() }
          : {}),
      });

      return;
    }

    if (title.trim().length < 3 || title.trim().length > 150) {
      setError("O título precisa ter entre 3 e 150 caracteres.");
      return;
    }

    createMutation.mutate({
      ...common,
      title: title.trim(),
      ...(description.trim()
        ? { description: description.trim() }
        : {}),
      ...(imageUrl.trim()
        ? { imageUrl: imageUrl.trim() }
        : {}),
    });
  }

  const previewTitle =
    mode === "import"
      ? selectedProduct?.title ?? ""
      : title;

  const previewImage =
    mode === "import"
      ? imageUrl.trim() || selectedProduct?.thumbnail || ""
      : imageUrl;

  return (
    <div className="auctioneer-layout">
      <form
        className="auctioneer-form"
        onSubmit={handleSubmit}
      >
        <div className="auctioneer-form-heading">
          <PackagePlus size={22} />
          <span>DADOS DO LOTE</span>
        </div>

        <div className="auctioneer-modes">
          <button
            type="button"
            className={mode === "manual" ? "active" : ""}
            aria-pressed={mode === "manual"}
            disabled={createMutation.isPending}
            onClick={() => changeMode("manual")}
          >
            CADASTRO MANUAL
          </button>

          <button
            type="button"
            className={mode === "import" ? "active" : ""}
            aria-pressed={mode === "import"}
            disabled={createMutation.isPending}
            onClick={() => changeMode("import")}
          >
            IMPORTAR PRODUTO
          </button>
        </div>

        {mode === "manual" ? (
          <>
            <label htmlFor="auction-title">
              NOME DO PRODUTO
            </label>

            <input
              id="auction-title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Ex.: Relógio de colecionador"
              maxLength={150}
              required
            />

            <label htmlFor="auction-description">
              DESCRIÇÃO
            </label>

            <textarea
              id="auction-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Descreva as características e o estado do produto."
              maxLength={3000}
              rows={5}
            />
          </>
        ) : (
          <>
            <ProductSearch
              selectedProduct={selectedProduct}
              onSelect={(product) => {
                setSelectedProduct(product);
                setError("");
              }}
            />

            <p className="auctioneer-hint">
              O nome, a descrição e a imagem do produto
              selecionado serão importados automaticamente
              do catálogo externo na publicação.
            </p>
          </>
        )}

        <label htmlFor="auction-image">
          URL DA IMAGEM (OPCIONAL)
        </label>

        <input
          id="auction-image"
          type="url"
          value={imageUrl}
          onChange={(event) =>
            setImageUrl(event.target.value)
          }
          placeholder="https://exemplo.com/produto.jpg"
          maxLength={2048}
        />

        <div className="auctioneer-fields">
          <div>
            <label htmlFor="auction-starting-bid">
              LANCE INICIAL (R$)
            </label>

            <input
              id="auction-starting-bid"
              type="text"
              inputMode="decimal"
              value={startingBid}
              onChange={(event) =>
                setStartingBid(event.target.value)
              }
              placeholder="Ex.: 150,00"
              required
            />
          </div>

          <div>
            <label htmlFor="auction-increment">
              INCREMENTO MÍNIMO (R$)
            </label>

            <input
              id="auction-increment"
              type="text"
              inputMode="decimal"
              value={minIncrement}
              onChange={(event) =>
                setMinIncrement(event.target.value)
              }
              placeholder="Ex.: 10,00"
              required
            />
          </div>

          <div>
            <label htmlFor="auction-starts-at">
              INÍCIO DO LEILÃO
            </label>

            <input
              id="auction-starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={(event) =>
                setStartsAt(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="auction-ends-at">
              ENCERRAMENTO
            </label>

            <input
              id="auction-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) =>
                setEndsAt(event.target.value)
              }
              required
            />
          </div>
        </div>

        {error && (
          <p className="auctioneer-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="auctioneer-submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? "PUBLICANDO LOTE..."
            : "PUBLICAR NOVO LOTE"}

          <ArrowUpRight size={20} />
        </button>

        <p className="auctioneer-hint">
          Os valores são simulados. A publicação será
          realizada imediatamente após a confirmação.
        </p>
      </form>

      <LotPreview
        mode={mode}
        title={previewTitle}
        imageUrl={previewImage}
        startingBid={startingBid}
      />
    </div>
  );
}