import { storage } from "../../config";
import { ref, getDownloadURL } from "firebase/storage";

export const getImage = async (imageUrl: string): Promise<string | null> => {
    try {
        return await getDownloadURL(ref(storage, `gs://chia1104.appspot.com/${imageUrl}`))
    } catch (e) {
        console.debug('getImage', e);
        return null;
    }
}
