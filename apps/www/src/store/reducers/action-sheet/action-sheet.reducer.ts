import type { IActionSheetState } from "./action-sheet.state";

const actionSheetReducer = {
  activeActionIconSheet: (state: { actionIconSheet: IActionSheetState }) => {
    state.actionIconSheet.isOpen = !state.actionIconSheet.isOpen;
  },
};

export default actionSheetReducer;
