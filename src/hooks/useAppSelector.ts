import {TypedUseSelectorHook, useSelector} from "react-redux";
import {AppState} from "@chia/src/store";

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector
