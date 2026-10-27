import { AureoLoader } from "./AureoLoader";
import "./SplashScreen.css";

export function SplashScreen() {
  return (
    <div className="aureo-splash">
      <div className="aureo-splash-glow" aria-hidden="true" />
      <AureoLoader />
      <span className="aureo-splash-footer">
        UMA EXPERIÊNCIA ÁUREO
      </span>
    </div>
  );
}