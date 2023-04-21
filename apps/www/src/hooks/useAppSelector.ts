import { type TypedUseSelectorHook, useSelector } from "react-redux";
import { AppState } from "@/store/type";

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
