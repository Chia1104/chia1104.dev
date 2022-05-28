import {TypedUseSelectorHook, useSelector} from "react-redux";
import {AppState} from "@/src/store";

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector
