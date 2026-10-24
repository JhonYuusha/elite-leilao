import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gavel,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useLots } from "../hooks/useLots";
import { useNow } from "../hooks/useNow";
import { LotCard } from "../components/LotCard";

export function Home() {
  const [search, setSearch] = useState("");
  const { data: lots = [], isLoading, isError, refetch } = useLots();
  const now = useNow();

  const filteredLots = lots.filter((lot) =>
    lot.title.toLocaleLowerCase("pt-BR").includes(
      search.trim().toLocaleLowerCase("pt-BR"),
    ),
  );

  const liveCount = lots.filter((lot) => {
    if (now === null || lot.status !== "LIVE") return false;

    const startsAt = new Date(lot.startsAt).getTime();
    const endsAt = new Date(lot.endsAt).getTime();

    return now >= startsAt && now < endsAt;
  }).length;

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Áureo — início">
          ÁUREO<span>.</span>
        </Link>

        <nav className="site-nav" aria-label="Navegação principal">
          <a href="#leiloes">LEILÕES</a>
          <a href="#como-funciona">COMO FUNCIONA</a>
        </nav>

        <a className="header-action" href="#leiloes">
          EXPLORAR LOTES <ArrowUpRight size={16} />
        </a>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-topline">
            <span>LEILÕES ONLINE / BRASIL</span>
            <span>PLATAFORMA DE LANCES SIMULADOS</span>
          </div>

          <div className="hero-layout">
            <div className="hero-copy">
              <span className="section-kicker">ABERTO PARA NOVOS LANCES</span>

              <h1>
                ENCONTRE.
                <br />
                DISPUTE.
                <br />
                <span>ARREMATE.</span>
              </h1>

              <p>
                Explore os lotes disponíveis, acompanhe os valores
                e participe de leilões online com saldo simulado.
              </p>
            </div>

            <div className="hero-side">
              <div className="hero-side__top">
                <span>CATÁLOGO / 2026</span>
                <Gavel size={27} strokeWidth={1.25} />
              </div>

              <label className="hero-search" htmlFor="lot-search">
                <span>BUSCAR NO CATÁLOGO</span>

                <div className="hero-search__field">
                  <input
                    id="lot-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome do produto ou lote"
                  />

                  <Search size={20} aria-hidden="true" />
                </div>
              </label>

              <a className="hero-explore" href="#leiloes">
                VER LOTES DISPONÍVEIS
                <ArrowDownRight size={21} />
              </a>
            </div>
          </div>

          <div className="hero-bottomline">
            <span>
  {liveCount} {liveCount === 1 ? "LEILÃO AO VIVO" : "LEILÕES AO VIVO"}</span>
            <span>01 / CATÁLOGO</span>
          </div>
        </section>

        <section className="auctions-section" id="leiloes">
          <div className="section-topline">
            <span>01 / CATÁLOGO</span>
            <span>LOTES DISPONÍVEIS</span>
          </div>

          <div className="catalog-heading">
            <div>
              <span className="section-kicker">
                ACOMPANHE AS DISPUTAS
              </span>

              <h2>LOTES EM DESTAQUE<span>.</span></h2>
            </div>

            <div className="catalog-heading__info">
              <span>{filteredLots.length} RESULTADO(S)</span>
              <p>
                Consulte os valores e os horários de encerramento
                de cada lote.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="catalog-message" role="status">
              CARREGANDO CATÁLOGO...
            </div>
          ) : isError ? (
            <div className="catalog-message" role="alert">
              <p>NÃO FOI POSSÍVEL CARREGAR OS LOTES.</p>
              <button type="button" onClick={() => void refetch()}>
                TENTAR NOVAMENTE <ArrowRight size={16} />
              </button>
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="catalog-message">
              {search.trim()
                ? "NENHUM LOTE ENCONTRADO PARA ESSA BUSCA."
                : "NENHUM LOTE DISPONÍVEL NO MOMENTO."}
            </div>
          ) : (
            <div className="lots-grid">
              {filteredLots.map((lot) => (
                <LotCard key={lot.id} lot={lot} now={now} />
              ))}
            </div>
          )}
        </section>

        <section className="how-section" id="como-funciona">
          <div className="section-topline">
            <span>02 / COMO FUNCIONA</span>
            <span>TRÊS PASSOS</span>
          </div>

          <div className="how-heading">
            <span className="section-kicker">SIMPLES E DIRETO</span>
            <h2>DO PRIMEIRO OLHAR AO ÚLTIMO LANCE.</h2>
          </div>

          <div className="how-grid">
            <article>
              <span className="how-number">01</span>
              <h3>EXPLORE</h3>
              <p>
                Navegue pelos lotes e confira os valores,
                descrições e prazos.
              </p>
            </article>

            <article>
              <span className="how-number">02</span>
              <h3>DISPUTE</h3>
              <p>
                Com saldo simulado, participe dos leilões
                e acompanhe os lances.
              </p>
            </article>

            <article>
              <span className="how-number">03</span>
              <h3>ARREMATE</h3>
              <p>
                Ao encerrar a disputa, o maior lance válido
                determina o vencedor.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <span className="footer-logo">ÁUREO<span>.</span></span>
          <p>LEILÕES ONLINE. LANCES SIMULADOS.</p>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ÁUREO / ELITE DEV</span>
          <span>DESENVOLVIDO PARA O DESAFIO ELITE DEV</span>
        </div>
      </footer>
    </>
  );
}