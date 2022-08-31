import type { FC } from "react";
import { Chia } from "@chia/shared/meta/chia";

const Footer: FC = () => {
  const year = new Date().getFullYear();
  const name = Chia.name;

  return (
    <footer className="footer">
      <p>
        ©{year}, {name}
      </p>
    </footer>
  );
};

export default Footer;
