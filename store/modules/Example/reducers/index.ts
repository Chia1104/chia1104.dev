export const exampleReducer = {
    beginRequestExampleData: (state: any) => {
        state.example.isLoading = true;
    },
    successRequestExampleData: (state: any, action: any) => {
        state.example.isLoading = false;
        state.example.data = action.payload;
    },
    failureRequestExampleData: (state: any) => {
        state.example.isLoading = false;
        state.example.isError = true;
    },
};
