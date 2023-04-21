import type { IActionSheetState } from "./action-sheet.state.ts";

const actionSheetReducer = {
  activeActionIconSheet: (state: { actionIconSheet: IActionSheetState }) => {
    state.actionIconSheet.isOpen = !state.actionIconSheet.isOpen;
  },
};

export default actionSheetReducer;
