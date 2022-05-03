import { FC } from "react";
import { useRouter } from 'next/router'

export const NavBar: FC = () => {
    const router = useRouter()

    return(
        <div className="w-screen flex h-[70px] items-center bg-white shadow-lg inset-x-0 top-0 fixed justify-center z-40">
            <div className="flex container w-[100%]">
                <div className="flex items-center w-[87%]">
                    CHIA WEB
                </div>
                <div className="md:flex items-center w-[13%] sm:hidden justify-center">
                    <button type="button" onClick={() => router.push('/post')}>
                        post
                    </button>
                    <button type="button" onClick={() => router.push('/result')}>
                        result
                    </button>
                </div>
            </div>
        </div>
    )
}
