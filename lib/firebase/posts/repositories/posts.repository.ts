import { DocumentData } from "@firebase/firestore-types";

export const dataToJSON = (doc: DocumentData)  => {
    const data = doc.data();
    return {
        ...data,
        createdAt: data?.createdAt.toMillis() || 0,
    };
}
