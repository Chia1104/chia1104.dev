import { FC } from "react";
import { Chia } from "@/utils/meta/chia"

export const Experience: FC = () => {
    const resume = Chia.resume;


    return (
        <div className="w-full flex flex-col">
            <h1 className="title pb-10 text-center">
                Experience
            </h1>
            {resume.map((experience, index) => (
                <div key={index} className="w-full flex flex-col c-border-primary border-b-2 p-5">
                    <h2 className="text-3xl pb-5">
                        {experience.title}
                    </h2>
                    <h3 className="text-xl pb-5">
                        {experience.work}
                    </h3>
                    <p className="c-description">
                        {experience.company} . {experience.duration}
                    </p>
                </div>
            ))}
        </div>
    )
}
