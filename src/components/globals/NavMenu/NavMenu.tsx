import { FC } from "react";
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import NextLink from "next/link";

export const NavMenu: FC = () => {

    return(
        <nav className="w-screen flex h-[75px] items-center top-0 fixed justify-center z-50 border-b-[1px] c-border-primary c-bg-secondary">
            <div className="flex container w-[100%]">
                <div className="flex items-center w-[70%] justify-start">
                    <NextLink href="/">
                        <a className="text-2xl ml-3 hover:c-text-green-to-purple transition ease-in-out">
                            Chia1104
                        </a>
                    </NextLink>
                </div>
                <div className="flex items-center w-[30%] justify-end mr-3">
                    <NextLink href="/about">
                        <a className="flex link link-underline link-underline-black mr-4 py-3">
                            <AccountCircleOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1"
                                aria-label={"About page"}
                            />
                            <h2 className="hidden md:block">
                                About
                            </h2>
                        </a>
                    </NextLink>
                    <NextLink href="/posts">
                        <a className="flex link link-underline link-underline-black mr-4 py-3">
                            <ArticleOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1"
                                aria-label={"Posts page"}
                            />
                            <h2 className="hidden md:block">
                                Posts
                            </h2>
                        </a>
                    </NextLink>
                    <NextLink href="/portfolios">
                        <a className="flex link link-underline link-underline-black mr-4 py-3">
                            <WorkspacesOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1"
                                aria-label={"Portfolios page"}
                            />
                            <h2 className="hidden md:block">
                                Portfolios
                            </h2>
                        </a>
                    </NextLink>
                </div>
            </div>
        </nav>
    )
}
