export const dataToJSON = (doc: any)  => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: data?.createdAt.toMillis() || 0,
    };
}
