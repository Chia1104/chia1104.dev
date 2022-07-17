import { type FC } from "react";

interface Props {
    codeSrc: string;
}

const MDXCodeSandBox: FC<Props> = (props) => {
    return (
        <div>
            <iframe
                src={props.codeSrc}
                loading="lazy"
                className="w-full h-full min-h-[500px] border-0 rounded-lg shadow-lg overflow-hidden my-10"
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                {...props}
            />
        </div>
    )
}

export default MDXCodeSandBox;
