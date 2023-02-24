import type { FC } from "react";
import { Chia } from "@chia/shared/meta/chia";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@chia/components/client";

const Experience: FC = () => {
  const resume = Chia.resume;

  return (
    <div className="w-full flex flex-col">
      <h2 className="title pb-10 text-center">
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          Experience
        </span>
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {resume.map((experience, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="items-start w-full">
              <div className="w-full flex flex-col c-border-primary border-b-2 p-5">
                <header className="subtitle pb-5 text-start">
                  {experience.title}
                </header>
                <p className="c-description pb-5 text-start">
                  {experience.work}
                </p>
                <p className="c-description text-start">
                  <span className="c-link text-info">
                    <a href={experience.link} target="_blank" rel="noreferrer">
                      {experience.company}
                    </a>
                  </span>
                  . {experience.duration}
                </p>
                {experience.detail && <p>MORE</p>}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {experience.detail ? (
                <ul className="list-disc list-inside c-description leading-loose list-inside">
                  {experience.detail.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default Experience;
