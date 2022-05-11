import { FC } from "react";
import { Chia } from"../../../../utils/meta/chia"

export const Footer: FC  = () => {
    const year = new Date().getFullYear();
    const name = Chia.name

    return(
        <footer className="footer">
            <p>
                ©{year}, {name}
            </p>
        </footer>
    )
}
