import { storage } from "../../../firebase.config";
import { ref, getDownloadURL, list } from "firebase/storage";

export const getImage = async (imageUrl: string): Promise<string> => {
  try {
    return await getDownloadURL(
      ref(storage, `gs://chia1104.appspot.com/images/${imageUrl}`)
    );
  } catch (e) {
    console.debug("Firebase file service getImage", e);
    return "";
  }
};

export const getListImageUrl = async () => {
  try {
    const listRef = ref(storage, `gs://chia1104.appspot.com/images/design`);
    const l = await list(listRef, { maxResults: 10 });
    const urlPromises = l.items.map((item) => getImage(`design/${item.name}`));
    return Promise.all(urlPromises);
  } catch (e) {
    console.debug("Firebase file service getListImageUrl", e);
    return [];
  }
};
