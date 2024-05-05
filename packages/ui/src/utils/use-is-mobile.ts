import { useMediaQuery } from "usehooks-ts";

const useIsMobile = (query = "(max-width: 640px)") => {
  return useMediaQuery(query);
};

export default useIsMobile;
