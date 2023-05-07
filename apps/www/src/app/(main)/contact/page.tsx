import { Contact } from "./components";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Me",
};

const ContactPage = () => {
  return (
    <article className="main c-container mt-10">
      <Contact />
    </article>
  );
};

export default ContactPage;
