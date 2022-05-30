import { useDispatch } from 'react-redux'
import {AppDispatch} from "@chia/src/store";

export const useAppDispatch = () => useDispatch<AppDispatch>()
