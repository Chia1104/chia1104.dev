import { type TypedUseSelectorHook, useSelector } from "react-redux";
import { AppState } from "@chia/store/type";

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
