import { useEffect, useMemo, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface UseRouterEventOpts {
  onRouteChange?: () => void;
  onRouterRemove?: () => void;
}

const useRouterEvent = (opts?: UseRouterEventOpts) => {
  opts ??= {};

  const { onRouteChange, onRouterRemove } = opts;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const url = useMemo(
    () => pathname + searchParams.toString(),
    [pathname, searchParams]
  );

  const handleRouteChange = useCallback(() => {
    onRouteChange?.();
  }, [onRouteChange]);

  const handleRouteRemove = useCallback(() => {
    onRouterRemove?.();
  }, [onRouterRemove]);

  useEffect(() => {
    handleRouteChange();
    return () => {
      handleRouteRemove();
    };
  }, [url, handleRouteChange, handleRouteRemove]);
};

export default useRouterEvent;
