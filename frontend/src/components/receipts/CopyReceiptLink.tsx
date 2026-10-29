import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Link2,
} from "lucide-react";

type CopyStatus = "idle" | "success" | "error";

export function CopyReceiptLink() {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus("idle");
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        window.location.href,
      );

      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "success"
      ? "LINK COPIADO!"
      : status === "error"
        ? "FALHA AO COPIAR"
        : "COPIAR LINK";

  return (
    <button
      type="button"
      className={`receipt-copy-button receipt-copy-${status}`}
      onClick={() => void handleCopy()}
      aria-label={label}
    >
      {status === "success" ? (
        <CheckCircle2 size={16} />
      ) : status === "error" ? (
        <AlertCircle size={16} />
      ) : (
        <Link2 size={16} />
      )}

      <span aria-live="polite">
        {label}
      </span>
    </button>
  );
}
