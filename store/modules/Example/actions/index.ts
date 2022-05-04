import { call } from 'redux-saga/effects';
import {
    BEGIN_REQUEST_EXAMPLE_DATA,
    SUCCESS_REQUEST_EXAMPLE_DATA,
    FAILURE_REQUEST_EXAMPLE_DATA,
} from "../../../../utils/actionType";
import { getAllRepos } from "../../../../api/example";

export const EXAMPLE_ACTION = 'EXAMPLE_ACTION';

function* exampleAction(user: string, page: number) {
    yield {
        type: BEGIN_REQUEST_EXAMPLE_DATA
    };
    try {
        const res: object = yield getAllRepos(user, page);
        if (res) {
            yield {
                type: SUCCESS_REQUEST_EXAMPLE_DATA,
                payload: res
            };
        }
    } catch (error) {
        yield {
            type: FAILURE_REQUEST_EXAMPLE_DATA
        };
    }
}

export { exampleAction };
