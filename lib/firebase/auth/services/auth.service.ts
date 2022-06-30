import {signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "../../config";

export const login = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export const getUser = () => {
    try {
        return auth.currentUser;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export const getUserObservable = () => {
    try {
        return auth.onAuthStateChanged;
    } catch (error) {
        console.error(error);
        return null;
    }
}
