import {type TypedUseSelectorHook, useSelector} from "react-redux";
import {AppState} from "@chia/store";

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector
