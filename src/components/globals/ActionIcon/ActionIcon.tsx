import GitHubIcon from '@mui/icons-material/GitHub';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import Brightness4OutlinedIcon from '@mui/icons-material/Brightness4Outlined';
import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined';
import { FC } from "react";

export const ActionIcon: FC = () => {

    return (
        <div className="fixed bottom-0 right-0 mr-10 mb-10 bg-white/80 p-3 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col justify-center items-center">
            <button>
                <KeyboardArrowUpOutlinedIcon
                    fontSize="small"
                />
            </button>
            <div className="flex">
                <button>
                    <Brightness4OutlinedIcon
                        fontSize="medium"
                        className="hover:text-secondary text-sec-text transition ease-in-out mr-3"
                    />
                </button>
                <div className="border-r"/>
                <a href="https://github.com/Chia1104" target="_blank" rel="noreferrer">
                    <GitHubIcon
                        fontSize="medium"
                        className="hover:text-secondary text-sec-text transition ease-in-out mx-3"
                    />
                </a>
                <a href="src/components/globals/ActionIcon/ActionIcon" target="_blank" rel="noreferrer">
                    <InstagramIcon
                        fontSize="medium"
                        className="hover:text-secondary text-sec-text transition ease-in-out mr-3"
                    />
                </a>
                <a href="https://www.linkedin.com/in/%E5%8F%88%E5%98%89-%E4%BF%9E-889664230/" target="_blank" rel="noreferrer">
                    <LinkedInIcon
                        fontSize="medium"
                        className="hover:text-secondary text-sec-text transition ease-in-out"
                    />
                </a>
            </div>
        </div>
    )
}
