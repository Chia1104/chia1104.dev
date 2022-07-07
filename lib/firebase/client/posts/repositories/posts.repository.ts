import type { DocumentData } from "@firebase/firestore-types";

export const dataToJSON = (doc: DocumentData)  => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: data?.createdAt.toMillis() || 0,
    };
}
