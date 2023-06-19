import { type FC } from "react";
import { Tailwind } from "@react-email/tailwind";

interface Props {
  title?: string;
  message?: string;
  email?: string;
  ip?: string;
}

const EmailTemplate: FC<Props> = ({ title, message, email, ip }) => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              cyan: "#79ffe1",
              purple: "#f81ce5",
              cyberpunk: "#F2E307",
            },
          },
        },
      }}>
      <main
        style={{
          backgroundImage: "radial-gradient(#535353 0.5px, transparent 0)",
          backgroundSize: "11px 11px",
        }}
        className="fixed left-0 top-0 block h-full w-full after:content-[''] ">
        <article className="flex h-full flex-col items-center justify-center">
          <h1 className="text-cyberpunk text-4xl font-bold">Contact Me</h1>
          <p className="text-cyberpunk text-2xl font-bold">Title: {title}</p>
          <p className="text-cyberpunk text-2xl font-bold">
            Message: {message}
          </p>
          <p className="text-cyberpunk text-2xl font-bold">Email: {email}</p>
          <p className="text-cyberpunk text-2xl font-bold">IP: {ip}</p>
        </article>
      </main>
    </Tailwind>
  );
};

export default EmailTemplate;
