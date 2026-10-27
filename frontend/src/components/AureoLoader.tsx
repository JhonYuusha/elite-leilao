import "../styles/components/AureoLoader.css";

interface AureoLoaderProps {
  compact?: boolean;
}

export function AureoLoader({ compact = false }: AureoLoaderProps) {
  return (
    <div
      className={`aureo-loader ${compact ? "aureo-loader--compact" : ""}`}
      role="status"
      aria-label="Carregando"
    >
      <svg
        className="aureo-loader-scale"
        viewBox="0 0 200 170"
        fill="none"
        aria-hidden="true"
      >
        <g className="aureo-loader-beam">
          <path d="M32 49H168" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M44 49L28 98M44 49L60 98" stroke="currentColor" strokeWidth="2" />
          <path d="M156 49L140 98M156 49L172 98" stroke="currentColor" strokeWidth="2" />
          <path d="M12 98Q44 128 76 98Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".12" />
          <path d="M124 98Q156 128 188 98Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".12" />
        </g>

        <path d="M100 30V145" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="29" r="7" fill="currentColor" />
        <path d="M76 146H124M65 156H135" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>

      {!compact && (
        <>
          <span className="aureo-loader-brand">ÁUREO<span>.</span></span>
          <span className="aureo-loader-caption">PREPARANDO SUA EXPERIÊNCIA</span>
          <span className="aureo-loader-progress" aria-hidden="true">
            <span />
          </span>
        </>
      )}
    </div>
  );
}