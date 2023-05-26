import { Chia } from "@/shared/meta/chia";
import { getAllPosts } from "@/helpers/mdx/services";
import dayjs from "dayjs";
import AboutMe from "./about-me";
import NewsCard from "./news-card";

const getHomePageData = async () => {
  const posts = await getAllPosts();

  return {
    post: posts[0],
  };
};

const HomePage = async () => {
  const { post } = await getHomePageData();

  return (
    <article className="c-container main">
      <div className="flex h-full w-full flex-col">
        <AboutMe avatarSrc="/me/me-memoji.PNG" />
        <div className="min:w-[370px] mx-auto mt-10 flex w-full max-w-[740px] flex-col items-center justify-center md:flex-row">
          <div className="px-3 py-7">
            <NewsCard title="About me" content={Chia.content} link="/about" />
          </div>
          <div className="px-3 py-7">
            <NewsCard
              title="New update"
              content={post?.excerpt || "This is an example of a blog post."}
              subtitle={dayjs(post?.createdAt).format("MMMM D, YYYY")}
              link={`/posts/${post?.slug}`}
            />
          </div>
        </div>
        <div className="min:w-[370px] bg-primary/90 mx-auto mt-10 w-full max-w-[740px] rounded-xl p-5 text-white backdrop-blur-sm">
          <ul>
            <li className="mb-2">
              🔭 I’m currently working on: My personal website with NextJS
            </li>
            <li className="mb-2">
              🌱 I’m currently learning: Docker, Next.js, Nest.js, TypeScript,
              Go
            </li>
            <li className="mb-2">👯 I’m looking to collaborate on: Intern</li>
            <li className="mb-2">📫 How to reach me: yuyuchia7423@gmail.com</li>
            <li>
              ⚡ Fun fact:
              <a
                href="https://open.spotify.com/user/21vnijzple4ufn2nzlfjy37py?si=b5f011d11a794ba4&nd=1"
                target="_blank"
                rel="noreferrer noopener"
                className="c-link text-info">
                {" "}
                Spotify{" "}
              </a>
              /{}
              <a
                href="https://skyline.github.com/Chia1104/2022"
                target="_blank"
                rel="noreferrer noopener"
                className="c-link text-info">
                {" "}
                {}
                Chia1104's 2022 GitHub Skyline{" "}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </article>
  );
};

export default HomePage;
