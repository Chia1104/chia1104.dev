import Contact from "./contact";
import type { Metadata } from "next";
import "./style.css";

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
