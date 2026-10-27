import { useEffect, useState } from "react";

export function useMinimumLoading(
  isLoading: boolean,
  minimumDuration = 1500,
) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMinimumElapsed(true);
    }, minimumDuration);

    return () => window.clearTimeout(timeout);
  }, [minimumDuration]);

  return isLoading || !minimumElapsed;
}