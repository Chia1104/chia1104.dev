import { dataToJSON } from "../repositories";
import {query, where, orderBy, collectionGroup, limit, getDocs} from 'firebase/firestore';
import { firestore } from '../../config';

export const queryPosts = async (Limit: number): Promise<Object> => {
    const ref = await collectionGroup(firestore, 'posts');
    const postsQuery = query(
        ref,
        where('published', '==', true),
        orderBy('createdAt', 'desc'),
        limit(Limit),
    )
    return(await getDocs(postsQuery)).docs.map(dataToJSON);
}
