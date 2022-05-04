import { applyMiddleware, configureStore } from '@reduxjs/toolkit'
import createSagaMiddleware from 'redux-saga'
import { reducers } from "./reducers";
import sagas from './sagas';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
    reducer: reducers,
    middleware: [sagaMiddleware],
    devTools: process.env.NODE_ENV !== 'production'
})

sagaMiddleware.run(sagas);
