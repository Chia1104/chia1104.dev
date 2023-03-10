export interface IActionSheetState {
  isOpen: boolean;
}

const actionSheetInitState = {
  actionIconSheet: {
    isOpen: false,
  } satisfies IActionSheetState,
};

export default actionSheetInitState;
