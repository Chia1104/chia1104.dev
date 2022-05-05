import { query, where, orderBy, limit, collectionGroup, getFirestore, Firestore } from 'firebase/firestore';

export class PostsRepository {
  constructor(private readonly db: Firestore) {}

  async getPosts(Limit: number): Promise<any> {
    const ref = await collectionGroup(getFirestore(), 'posts');
    return query(
        ref,
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        limit(Limit),
    );
  }
}
