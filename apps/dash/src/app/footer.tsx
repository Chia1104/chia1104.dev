import type { FC } from "react";
import { getToday } from "utils";

const Footer: FC = () => {
  return (
    <footer className="footer">
      <p className="mr-5">©{getToday()}, chia1104.dev TEST</p>
    </footer>
  );
};

export default Footer;
