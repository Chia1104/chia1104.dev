import {query, where, orderBy, collectionGroup } from 'firebase/firestore';
import { firestore } from '../../config';
import firebase from "firebase/compat";

export class PostsRepository {
    async getPosts(): Promise<any> {
        const ref = await collectionGroup(firestore, 'posts');
        return query(
            ref,
            where('published', '==', true),
            orderBy('createdAt', 'desc'),
        );
    }

    dataToJSON(doc: any): Promise<JSON> {
        const data = doc.data();
        return {
            ...data,
            createdAt: data?.createdAt.toMillis() || 0,
            updatedAt: data?.updatedAt.toMillis() || 0,
        };
    }
}
