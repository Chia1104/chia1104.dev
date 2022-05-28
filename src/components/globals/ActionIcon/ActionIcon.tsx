import GitHubIcon from '@mui/icons-material/GitHub';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import Brightness4OutlinedIcon from '@mui/icons-material/Brightness4Outlined';
import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined';
import Brightness5OutlinedIcon from '@mui/icons-material/Brightness5Outlined';
import { useTheme } from 'next-themes'
import { FC, useState, useEffect } from "react";
import {Contact} from "@/components/globals/ActionIcon/Contact";
import { useAppDispatch } from "@/src/hooks/useAppDispatch";
import { useAppSelector } from "@/src/hooks/useAppSelector";
import {activeActionIconSheet, selectActionIconSheet} from "@/store/modules/ActionSheet/actionSheet.slice";

export const ActionIcon: FC = () => {
    const dispatch = useAppDispatch()
    const actionIconSheet = useAppSelector(selectActionIconSheet)
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <div className="fixed bottom-0 right-0 mr-10 mb-10 p-3 rounded-xl shadow-2xl flex flex-col justify-center items-center c-bg-secondary z-40">
            {
                actionIconSheet && <Contact />
            }
            <button
                aria-label={"Open contact"}
                onClick={() => dispatch(activeActionIconSheet())}
            >
                <KeyboardArrowUpOutlinedIcon
                    fontSize="small"
                />
            </button>
            <div className="flex">
                <button
                    aria-label={"Light or Dark"}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {
                        mounted &&
                        <>
                            {
                                theme === 'dark'
                                    ? <Brightness4OutlinedIcon
                                        fontSize="medium"
                                        className="hover:text-secondary transition ease-in-out mr-3"
                                        aria-label={"Dark"}
                                    />
                                    : <Brightness5OutlinedIcon
                                        fontSize="medium"
                                        className="hover:text-secondary transition ease-in-out mr-3"
                                        aria-label={"Light"}
                                    />
                            }
                        </>
                    }
                </button>
                <div className="border-r"/>
                <a
                    href="https://github.com/Chia1104"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={"Open GitHub"}
                >
                    <GitHubIcon
                        fontSize="medium"
                        className="hover:text-secondary transition ease-in-out mx-3"
                        aria-label={"Open GitHub"}
                    />
                </a>
                <a
                    href="https://www.instagram.com/chia_1104/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={"Open Instagram"}
                >
                    <InstagramIcon
                        fontSize="medium"
                        className="hover:text-secondary transition ease-in-out mr-3"
                        aria-label={"Open Instagram"}
                    />
                </a>
                <a
                    href="https://www.linkedin.com/in/%E5%8F%88%E5%98%89-%E4%BF%9E-889664230/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={"Open LinkedIn"}
                >
                    <LinkedInIcon
                        fontSize="medium"
                        className="hover:text-secondary transition ease-in-out"
                        aria-label={"Open LinkedIn"}
                    />
                </a>
            </div>
        </div>
    )
}
