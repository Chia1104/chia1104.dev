export const dataToJSON = (doc: any): Promise<JSON>  => {
    const data = doc.data();
    return {
        ...data,
        createdAt: data?.createdAt.toMillis() || 0,
    };
}
