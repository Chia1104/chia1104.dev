import { applyMiddleware, configureStore } from '@reduxjs/toolkit'
import createSagaMiddleware from 'redux-saga'
import { createWrapper } from 'next-redux-wrapper'
import { reducers } from "./reducers";

const sagaMiddleware = createSagaMiddleware();

// const bindMiddleware = (middleware: any) => {
//     if (process.env.NODE_ENV !== 'production') {
//         const { composeWithDevTools } = require('redux-devtools-extension')
//         return composeWithDevTools(applyMiddleware(...middleware))
//     }
//     return applyMiddleware(...middleware)
// }
//
//
// const store = configureStore({
//     reducers,
//     middleware: bindMiddleware([sagaMiddleware])
// })
