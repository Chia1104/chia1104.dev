import { all } from 'redux-saga/effects';
import { exampleSagas } from "./modules/Example/sagas";

export default function* rootSaga() {
    yield all([
        ...exampleSagas,
    ]);
}
