import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      setNow(Date.now());
    };

    update();

    const interval = window.setInterval(
      update,
      intervalMs,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}