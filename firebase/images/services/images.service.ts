import { storage } from "../../config";
import { ref, getDownloadURL } from "firebase/storage";

export const getChiaImage = async (imageName: string) => {
    try {
        return await getDownloadURL(ref(storage, `gs://chia1104.appspot.com/me-images/${imageName}`))
    } catch (e) {
        console.debug('getChiaImage', e);
        return null;
    }
}
