interface IExampleState {
  data: object;
  loading: "idle" | "pending" | "succeeded" | "failed";
  error: any;
}

export const exampleInitState = {
  example: {
    data: [],
    loading: "idle",
    error: null,
  } as IExampleState,
};
