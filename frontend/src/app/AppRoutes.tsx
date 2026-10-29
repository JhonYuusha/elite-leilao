import { Link, Route, Routes } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useRealtimeLots } from "../hooks/useRealtimeLots";
import { AuctioneerDashboard } from "../pages/AuctioneerDashboard";
import { Home } from "../pages/Home";
import { Login } from "../pages/Login";
import { LotDetails } from "../pages/LotDetails";
import { MyBids } from "../pages/MyBids";
import { PublicReceipt } from "../pages/PublicReceipt";

function NotFound() {
  return (
    <main className="not-found">
      <h1>PÁGINA NÃO ENCONTRADA.</h1>
      <Link to={ROUTES.HOME}>VOLTAR AO INÍCIO</Link>
    </main>
  );
}

export function AppRoutes() {
  useRealtimeLots();

  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<Home />} />
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route
        path={ROUTES.LOT_DETAILS}
        element={<LotDetails />}
      />
      <Route
        path={ROUTES.AUCTIONEER_DASHBOARD}
        element={<AuctioneerDashboard />}
      />
      <Route
        path={ROUTES.MY_BIDS}
        element={<MyBids />}
      />
      <Route
        path={ROUTES.PUBLIC_RECEIPT}
        element={<PublicReceipt />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}