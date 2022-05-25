import { FC } from 'react';

interface Props {
    data: string[];
}

export const Chip: FC<Props> = ({ data }) => {
    return (
        <div className="flex mt-3">
            {
                data.map((item, index) => (
                    <div className="rounded-full c-border-primary border-2 c-bg-secondary mx-2" key={index}>
                        <p className="text-center c-description px-1">
                            {item || 'Chip'}
                        </p>
                    </div>
                ))
            }
        </div>
    );
};
