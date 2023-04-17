import type { FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import { SiGithub, SiInstagram, SiLinkedin } from "react-icons/si";

const Footer: FC = () => {
  const year = new Date().getFullYear();
  const name = Chia.name;
  const GITHUB = Chia.link.github;
  const INSTAGRAM = Chia.link.instagram;
  const LINKEDIN = Chia.link.linkedin;

  return (
    <footer className="footer">
      <p className="mr-5">
        ©{year}, {name}
      </p>
      <div className="flex gap-3">
        <a
          href={GITHUB}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open GitHub"}
          className="mx-3 transition ease-in-out hover:text-secondary">
          <SiGithub className="h-5 w-5" />
        </a>
        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open Instagram"}
          className="mr-3 transition ease-in-out hover:text-secondary">
          <SiInstagram className="h-5 w-5" />
        </a>
        <a
          href={LINKEDIN}
          target="_blank"
          rel="noreferrer"
          aria-label={"Open LinkedIn"}
          className="transition ease-in-out hover:text-secondary">
          <SiLinkedin className="h-5 w-5" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;
