import { FC } from "react";
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import NextLink from "next/link";

export const NavMenu: FC = () => {

    return(
        <nav className="w-screen flex h-[75px] items-center bg-white/90 top-0 fixed justify-center z-40 border-b-[1px] border-gray-200 backdrop-blur-sm">
            <div className="flex container w-[100%]">
                <div className="flex items-center w-[70%] justify-start">
                    <h1 className="text-2xl ml-3 text-sec-text">
                        Chia1104
                    </h1>
                </div>
                <div className="md:flex items-center w-[30%] sm:hidden justify-end">
                    <NextLink href="/home">
                        <a className="flex c-hover-link mr-4">
                            <HomeOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1 text-sec-text"
                            />
                            <h2 className="text-sec-text">
                                Home
                            </h2>
                        </a>
                    </NextLink>
                    <NextLink href="post">
                        <a className="flex c-hover-link mr-4">
                            <ArticleOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1 text-sec-text"
                            />
                            <h2 className="text-sec-text">
                                Post
                            </h2>
                        </a>
                    </NextLink>
                    <NextLink href="/result">
                        <a className="flex c-hover-link mr-4">
                            <WorkspacesOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1 text-sec-text"
                            />
                            <h2 className="text-sec-text">
                                Result
                            </h2>
                        </a>
                    </NextLink>
                </div>
                <div className="md:hidden items-center w-[30%] sm:flex justify-end">
                    <NextLink href="/home">
                        <a className="flex c-hover-link mr-4">
                            <HomeOutlinedIcon
                                fontSize={'large'}
                                className="mr-1 text-sec-text"
                            />
                        </a>
                    </NextLink>
                    <NextLink href="post">
                        <a className="flex c-hover-link mr-4">
                            <ArticleOutlinedIcon
                                fontSize={'large'}
                                className="mr-1 text-sec-text"
                            />
                        </a>
                    </NextLink>
                    <NextLink href="/result">
                        <a className="flex c-hover-link mr-4">
                            <WorkspacesOutlinedIcon
                                fontSize={'large'}
                                className="mr-1 text-sec-text"
                            />
                        </a>
                    </NextLink>
                </div>
            </div>
        </nav>
    )
}
