import { FC } from "react";
import { Chia } from "@chia/utils/meta/chia"

export const Experience: FC = () => {
    const resume = Chia.resume;


    return (
        <div className="w-full flex flex-col">
            <h2 className="title pb-10 text-center">
                <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">Experience</span>
            </h2>
            {resume.map((experience, index) => (
                <div key={index} className="w-full flex flex-col c-border-primary border-b-2 p-5">
                    <header className="subtitle pb-5">
                        {experience.title}
                    </header>
                    <p className="c-description pb-5">
                        {experience.work}
                    </p>
                    <p className="c-description">
                        <span className="c-link text-info">
                            <a href={experience.link} target="_blank" rel="noreferrer">
                                {experience.company}
                            </a>
                        </span>
                        . {experience.duration}
                    </p>
                </div>
            ))}
        </div>
    )
}
