import { FC } from 'react'
import Image from "next/image";
import { Chia } from "@/utils/meta/chia"
import {Experience} from "@/components/pages/about/Resume/Experience";
import {LanAndTools} from "@/components/pages/about/Resume/LanAndTools";

interface Props {
    avatarSrc: string
}

export const Resume: FC<Props> = ({avatarSrc}) => {
    const name = Chia.name
    const chineseName = Chia.chineseName
    const title = Chia.title
    const content = Chia.content
    const fullName = Chia.fullName
    const phone = Chia.phone
    const email = Chia.email

    return (
        <div className="flex flex-col w-full">
            <div className="flex max-w-[800px] self-center flex-col md:flex-row mb-10">
                <div className="md:w-[40%] w-full flex justify-center items-center">
                    <div className="w-[150px] h-[150px] rounded-full overflow-hidden c-border-primary border-2 flex justify-center items-center">
                        <Image
                            src={avatarSrc || '/favicon.ico'}
                            alt="Chia1104"
                            width={400}
                            height={300}
                            priority
                        />
                    </div>
                </div>
                <div className="md:w-[60%] w-full flex flex-col mt-10 md:mt-0">
                    <h1 className="title text-center md:text-left pb-5 flex flex-col md:flex-row">
                        {name} - {chineseName}  <span className="animate-waving-hand">👋</span>
                    </h1>
                    <h2 className="text-lg text-center md:text-left ">
                        {content}
                    </h2>
                </div>
            </div>
            <div className="mb-10 max-w-[800px] self-center">
                <p className="c-description pb-5">
                    本身雖然不是資工本科系的學生， 但也在大學期間除了學校所學，也加以學習網頁前後端及手機APP的開發，並嘗試學習DevOps，增加自己的 實作經驗，希望在技術跌代快速的時代，加以學習並盡早步上軌道。
                </p>
                <p className="c-description pb-5">
                    自己是個樂觀開朗的人，勇於接受挑戰並實踐。過去做畢專的時候有過主動幫助組員解決問題，和獨立完成事務的經驗。 並且畢專結束後，仍然持續地維護並加以優化專案，從中學習和延伸更多的技術。熱愛寫程式的我，在GitHub上平均每個禮拜 都會有4, 5天在做提交的動作，除此之外閱讀網路文章和聽音樂也是我的興趣。
                </p>
                <p className="c-description pb-5">
                    大學期間有參加過友會性質的社團，並且擔任過美宣長，除了了解團隊之間溝通的重要性，也在返鄉服務的活動中帶領學弟妹規劃不同的活動。 而當時的活動海報和營手冊也是自己設計的，並且在網路上發佈，讓大家可以看到自己的作品。除此之外大學期間自己也學會做海報DM和剪片， 更是在打工的時候幫主管設計了活動海報，並且在系上的畢專海報甄選獲得第二名。除此之外更是幫助系上或主管剪不同活動的宣傳影片。
                </p>
            </div>
            <div className="w-full flex flex-col items-center">
                <button className="c-button-secondary mb-10">
                    Contact me
                </button>
                <div className="w-[85%] mt-10 lg:w-[55%]">
                    <ul className="c-description w-full">
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Full Name:
                            </span>
                            <span className="w-[70%]">
                                {fullName} - {chineseName}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Title:
                            </span>
                            <span className="w-[70%]">
                                {title}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Phone:
                            </span>
                            <span className="w-[70%]">
                                {phone}
                            </span>
                        </li>
                        <li className="mb-3 w-full flex">
                            <span className="w-[30%]">
                                Email:
                            </span>
                            <span className="w-[70%]">
                                {email}
                            </span>
                        </li>
                    </ul>
                </div>
                <div className="mt-20 w-full">
                    <LanAndTools/>
                </div>
                <div className="mt-20 w-full">
                    <Experience />
                </div>
            </div>
        </div>
    )
}
