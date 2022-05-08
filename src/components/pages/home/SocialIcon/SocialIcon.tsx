import GitHubIcon from '@mui/icons-material/GitHub';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookOutlinedIcon from '@mui/icons-material/FacebookOutlined';
import { FC } from "react";

export const SocialIcon: FC = () => {

    return (
        <div className="absolute bottom-0 right-0 mr-10 mb-10 bg-white/20 p-3 rounded-xl shadow-2xl">
            <a href="https://github.com/Chia1104" target="_blank" rel="noreferrer">
                <GitHubIcon
                    fontSize="large"
                    className="hover:text-secondary text-sec-text transition ease-in-out mr-3"
                />
            </a>
            <a href="https://www.instagram.com/chia_1104/" target="_blank" rel="noreferrer">
                <InstagramIcon
                    fontSize="large"
                    className="hover:text-secondary text-sec-text transition ease-in-out mr-3"
                />
            </a>
            <a href="https://www.facebook.com/profile.php?id=100010013018832" target="_blank" rel="noreferrer">
                <FacebookOutlinedIcon
                    fontSize="large"
                    className="hover:text-secondary text-sec-text transition ease-in-out"
                />
            </a>
        </div>
    )
}
