import { useState, useEffect } from "react";

export default function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMounted(true);
    }
    return () => setIsMounted(false);
  }, []);

  return isMounted;
}
