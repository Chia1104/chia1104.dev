import { storage } from "../../config";
import { ref, getDownloadURL } from "firebase/storage";

export const getImage = async (imageUrl: string): Promise<string> => {
    try {
        return await getDownloadURL(ref(storage, `gs://chia1104.appspot.com/images/${imageUrl}`))
    } catch (e) {
        console.debug('Firebase image service getImage', e);
        return '';
    }
}
