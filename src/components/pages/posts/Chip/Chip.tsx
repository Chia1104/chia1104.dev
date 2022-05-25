import { FC } from 'react';

interface Props {
    data: string[];
}

export const Chip: FC<Props> = ({ data }) => {
    return (
        <div className="flex mt-3 flex-wrap">
            {
                data.map((item, index) => (
                    <div className="rounded-full c-border-primary border-2 c-bg-secondary mr-2 my-1" key={index}>
                        <p className="text-center c-description px-2 text-base">
                            {item || 'Chip'}
                        </p>
                    </div>
                ))
            }
        </div>
    );
};
