import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { AureoLoader } from "../components/AureoLoader";
import { useAuth } from "../hooks/useAuth";

import "./Login.css";

const demoAccounts = [
  {
    label: "LEILOEIRO",
    description: "Crie lotes e gerencie leilões.",
    email: "leiloeiro@demo.local",
  },
  {
    label: "PARTICIPANTE 01",
    description: "Participe dos leilões e gerencie sua carteira.",
    email: "participante1@demo.local",
  },
  {
    label: "PARTICIPANTE 02",
    description: "Dispute lotes com outro participante.",
    email: "participante2@demo.local",
  },
];

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//")
      ? location.state.from
      : "/";

  function selectDemoAccount(accountEmail: string) {
    if (isSubmitting) return;

    setEmail(accountEmail);
    setPassword("Demo@123456");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.error;

        setError(
          typeof message === "string"
            ? message
            : "Não foi possível conectar ao servidor.",
        );
      } else {
        setError("Ocorreu um erro inesperado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user) {
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <Link to="/" className="brand">
          ÁUREO<span>.</span>
        </Link>

        <Link to="/" className="login-back">
          <ArrowLeft size={16} />
          VOLTAR AO CATÁLOGO
        </Link>
      </header>

      <main className="login-main">
        <div className="login-intro">
          <span className="login-kicker">
            ACESSO EXCLUSIVO / ÁUREO
          </span>

          <h1>
            SUA PRÓXIMA
            <br />
            CONQUISTA <em>COMEÇA AQUI.</em>
          </h1>

          <p>
            Entre na sua conta para acompanhar leilões,
            administrar sua carteira e participar das disputas.
          </p>

          <div className="demo-accounts">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="demo-account"
                disabled={isSubmitting}
                onClick={() => selectDemoAccount(account.email)}
              >
                <span>
                  <strong>{account.label}</strong>
                  <small>{account.description}</small>
                </span>

                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          <div className="login-form-heading">
            <LockKeyhole size={22} />
            <h2>ENTRAR NA PLATAFORMA</h2>
          </div>

          <label htmlFor="login-email">E-MAIL</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            disabled={isSubmitting}
            required
          />

          <label htmlFor="login-password">SENHA</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            disabled={isSubmitting}
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={isSubmitting ? "login-submit-loading" : ""}
          >
            {isSubmitting ? (
              <>
                <span>AUTENTICANDO...</span>
                <AureoLoader compact />
              </>
            ) : (
              <>
                <span>ACESSAR MINHA CONTA</span>
                <ArrowRight size={19} />
              </>
            )}
          </button>

          <p className="login-footnote">
            Ambiente de demonstração do sistema de leilões ÁUREO.
          </p>
        </form>
      </main>
    </div>
  );
}