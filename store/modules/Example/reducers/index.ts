import { exampleInitState } from "../state";
import {
    BEGIN_REQUEST_EXAMPLE_DATA,
    SUCCESS_REQUEST_EXAMPLE_DATA,
    FAILURE_REQUEST_EXAMPLE_DATA,
} from "../../../../utils/actionType";

export const exampleReducer = (
    state = exampleInitState,
    action: { type: any; payload: any; }
) =>
{
    switch (action.type)
    {
        case BEGIN_REQUEST_EXAMPLE_DATA:
            return {
                ...state,
                isLoading: true,
                isError: false,
            };
        case SUCCESS_REQUEST_EXAMPLE_DATA:
            return {
                ...state,
                isLoading: false,
                isError: false,
                data: action.payload,
            };
        case FAILURE_REQUEST_EXAMPLE_DATA:
            return {
                ...state,
                isLoading: false,
                isError: true,
            };
        default:
            return state;
    }
};
