import { useDispatch } from "react-redux";
import { type AppDispatch } from "@chia/store/type";

export const useAppDispatch = () => useDispatch<AppDispatch>();
