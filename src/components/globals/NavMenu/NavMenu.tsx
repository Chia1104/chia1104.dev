import { FC } from "react";
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import NextLink from "next/link";
import cx from "classnames";
import { useRouter } from 'next/router'

export const NavMenu: FC = () => {
    const router = useRouter()

    return(
        <nav className="w-screen flex h-[75px] items-center top-0 fixed justify-center z-50 border-b-[1px] c-border-primary c-bg-secondary">
            <div className="flex container w-[100%]">
                <div className="flex items-center w-[70%] justify-start">
                    <NextLink href="/" passHref>
                        <a className="subtitle ml-3 hover:c-text-green-to-purple transition ease-in-out">
                            Chia1104
                        </a>
                    </NextLink>
                </div>
                <div className="flex items-center w-[30%] justify-end mr-3">
                    <NextLink href="/about/" passHref>
                        <a className={cx('flex c-link mr-4 py-3', router.asPath.includes('about') && 'c-link-active')}>
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
                    <NextLink href="/posts/" passHref>
                        <a className={cx('flex c-link mr-4 py-3', router.asPath.includes('posts') && 'c-link-active')}>
                            <ArticleOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1"
                                aria-label={"Posts page"}
                            />
                            <h2 className="hidden md:block">
                                Blog
                            </h2>
                        </a>
                    </NextLink>
                    <NextLink href="/portfolio/" passHref>
                        <a className={cx('flex c-link mr-4 py-3', router.asPath.includes('portfolio') && 'c-link-active')}>
                            <WorkspacesOutlinedIcon
                                fontSize={'medium'}
                                className="mr-1"
                                aria-label={"Portfolios page"}
                            />
                            <h2 className="hidden md:block">
                                Portfolio
                            </h2>
                        </a>
                    </NextLink>
                </div>
            </div>
        </nav>
    )
}
