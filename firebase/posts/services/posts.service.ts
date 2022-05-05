import { PostsRepository } from "../repositories";
import { getDocs, limit } from "@firebase/firestore";

export class PostsService {
    constructor(private readonly postsRepository: PostsRepository) {}

    public async getPosts(Limit: number): Promise<JSON> {
        const queryPosts = await this.postsRepository
            .getPosts()
            .then(posts => {
                limit(Limit)
                getDocs(posts)
                return posts;
            })

        return await this.postsRepository.dataToJSON(queryPosts);
    }
}
