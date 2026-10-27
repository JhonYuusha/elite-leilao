
import { ArrowLeft, Gavel } from "lucide-react";
import { Link } from "react-router-dom";

import { AccountMenu } from "../components/AccountMenu";
import { LotCreationForm } from "../components/auctioneer/LotCreationForm";
import { ManagedLots } from "../components/auctioneer/ManagedLots";
import { USER_ROLES } from "../constants/auction";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";

import "../styles/pages/AuctioneerDashboard.css";

export function AuctioneerDashboard() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main
        className="auctioneer-state"
        role="status"
      >
        VERIFICANDO ACESSO...
      </main>
    );
  }

  if (!user || user.role !== USER_ROLES.AUCTIONEER) {
    return (
      <main className="auctioneer-state">
        <Gavel size={32} />

        <h1>ACESSO RESTRITO.</h1>

        <p>
          Esta área é exclusiva para contas de leiloeiro.
        </p>

        <Link to={user ? ROUTES.HOME : ROUTES.LOGIN}>
          VOLTAR
        </Link>
      </main>
    );
  }

  return (
    <div className="auctioneer-page">
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
            VOLTAR AO CATÁLOGO
          </Link>

          <AccountMenu />
        </div>
      </header>

      <main className="auctioneer-main">
        <div className="auctioneer-topline">
          <span>ÁUREO / ADMINISTRAÇÃO</span>
          <span>ACESSO DO LEILOEIRO</span>
        </div>

        <div className="auctioneer-heading">
          <span className="section-kicker">
            GERENCIAMENTO DE LEILÕES
          </span>

          <h1>
            PAINEL DO LEILOEIRO<span>.</span>
          </h1>

          <p>
            Acompanhe seus leilões, consulte os resultados
            e publique novos lotes no catálogo.
          </p>
        </div>

        <ManagedLots enabled />

        <div className="auctioneer-heading auctioneer-create-heading">
          <span className="section-kicker">
            PUBLICAÇÃO
          </span>

          <h2>
            NOVO LOTE<span>.</span>
          </h2>

          <p>
            Prepare um novo leilão, defina as condições da disputa
            e publique seu lote no catálogo.
          </p>
        </div>

        <LotCreationForm />
      </main>
    </div>
  );
}