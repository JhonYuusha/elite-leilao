import { useEffect, useState } from "react";
import { Check, ImageOff, Search } from "lucide-react";

import {
  searchExternalProducts,
  type ExternalProduct,
} from "../../services/product-search.service";

import "../../styles/components/ProductSearch.css";

interface ProductSearchProps {
  selectedProduct: ExternalProduct | null;
  onSelect: (product: ExternalProduct) => void;
}

export function ProductSearch({
  selectedProduct,
  onSelect,
}: ProductSearchProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const query = search.trim();

    if (!query) return;

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const results = await searchExternalProducts(
          query,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setProducts(results);
        setHasSearched(true);
      } catch {
        if (controller.signal.aborted) return;

        setError("Não foi possível consultar a DummyJSON.");
        setProducts([]);
        setHasSearched(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  return (
    <div className="product-search">
      <label htmlFor="external-product-search">
        PESQUISAR PRODUTO NA DUMMYJSON
      </label>

      <div className="product-search__input">
        <Search size={18} aria-hidden="true" />

        <input
          id="external-product-search"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setProducts([]);
            setHasSearched(false);
            setError("");
          }}
          placeholder="Ex.: phone, watch, laptop..."
          autoComplete="off"
        />
      </div>

      <p className="auctioneer-hint">
        Pesquise pelo nome e selecione o produto que deseja
        importar. O catálogo externo utiliza nomes em inglês.
      </p>

      {isLoading && (
        <p className="product-search__message" role="status">
          PESQUISANDO PRODUTOS...
        </p>
      )}

      {error && (
        <p className="product-search__message" role="alert">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        hasSearched &&
        products.length === 0 && (
          <p className="product-search__message">
            NENHUM PRODUTO ENCONTRADO.
          </p>
        )}

      {products.length > 0 && (
        <div className="product-search__results">
          {products.map((product) => {
            const isSelected =
              selectedProduct?.id === product.id;

            return (
              <button
                key={product.id}
                type="button"
                className={`product-search__item ${
                  isSelected
                    ? "product-search__item--selected"
                    : ""
                }`}
                onClick={() => onSelect(product)}
                aria-pressed={isSelected}
              >
                <span className="product-search__image">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <ImageOff size={22} />
                  )}
                </span>

                <span className="product-search__details">
                  <strong>{product.title}</strong>
                  <small>
                    {product.category} / ID {product.id}
                  </small>
                </span>

                {isSelected ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <span className="product-search__select">
                    SELECIONAR
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedProduct && (
        <div className="product-search__selection">
          <Check size={18} aria-hidden="true" />
          <span>
            PRODUTO SELECIONADO:{" "}
            <strong>{selectedProduct.title}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
