import { call, put } from 'redux-saga/effects';
import { getAllRepos } from "../../../../api/example";
import {
    beginRequestExampleData,
    successRequestExampleData,
    failureRequestExampleData,
} from "../exampleSlice";

export function* getExampleData(user: string, page: number): Generator<any, any, any> {
    yield put(beginRequestExampleData)
    try {
        const res = yield call(() => getAllRepos(user, page));
        if (res.status === 200) yield put(successRequestExampleData(res.data))
        else yield put(failureRequestExampleData)
    } catch (e) {
        yield put(failureRequestExampleData)
    }
}
