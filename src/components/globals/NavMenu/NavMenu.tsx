import { FC } from "react";
import { useRouter } from 'next/router'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import Image from "next/image";

export const NavMenu: FC = () => {
    const router = useRouter()

    return(
        <nav className="w-screen flex h-[75px] items-center bg-white/90 top-0 fixed justify-center z-40 border-b-[1px] border-gray-200 backdrop-blur-sm">
            <div className="flex container w-[100%]">
                <div className="flex items-center w-[70%]">
                    <Image
                        src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/me-images%2Fme-memoji.PNG?alt=media&token=7ac17143-80b4-4246-9f42-baa95fd45ce1"
                        alt="Chia1104"
                        width={55}
                        height={55}
                        className="rounded-full"
                        priority
                    />
                    <h1 className="text-2xl ml-3 text-sec-text">
                        Chia1104
                    </h1>
                </div>
                <div className="md:flex items-center w-[30%] sm:hidden justify-end">
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/home')}
                    >
                        <HomeOutlinedIcon
                            fontSize={'medium'}
                            className="mr-1 text-sec-text"
                        />
                        <h2 className="text-sec-text">
                            Home
                        </h2>
                    </button>
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/post')}
                    >
                        <ArticleOutlinedIcon
                            fontSize={'medium'}
                            className="mr-1 text-sec-text"
                        />
                        <h2 className="text-sec-text">
                            Post
                        </h2>
                    </button>
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/result')}
                    >
                        <WorkspacesOutlinedIcon
                            fontSize={'medium'}
                            className="mr-1 text-sec-text"
                        />
                        <h2 className="text-sec-text">
                            Result
                        </h2>
                    </button>
                </div>
                <div className="md:hidden items-center w-[30%] sm:flex justify-end">
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/home')}
                    >
                        <HomeOutlinedIcon
                            fontSize={'large'}
                            className="mr-1 text-sec-text"
                        />
                    </button>
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/post')}
                    >
                        <ArticleOutlinedIcon
                            fontSize={'large'}
                            className="mr-1 text-sec-text"
                        />
                    </button>
                    <button
                        className="flex c-hover-link mr-4"
                        type="button"
                        onClick={() => router.push('/result')}
                    >
                        <WorkspacesOutlinedIcon
                            fontSize={'large'}
                            className="mr-1 text-sec-text"
                        />
                    </button>
                </div>
            </div>
        </nav>
    )
}
