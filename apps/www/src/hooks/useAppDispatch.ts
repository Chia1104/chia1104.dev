import { useDispatch } from "react-redux";
import { type AppDispatch } from "@/store/type";

export const useAppDispatch = () => useDispatch<AppDispatch>();
