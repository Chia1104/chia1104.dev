import { FC } from "react";

export const Footer: FC  = () => {
    const year = new Date().getFullYear();

    return(
        <footer className="footer">
            <p>
                @Copyright {year}, Chia
            </p>
        </footer>
    )
}
