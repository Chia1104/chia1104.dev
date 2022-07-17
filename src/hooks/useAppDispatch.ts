import { useDispatch } from 'react-redux'
import {type AppDispatch} from "@chia/store";

export const useAppDispatch = () => useDispatch<AppDispatch>()
