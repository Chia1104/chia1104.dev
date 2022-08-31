import type { IActionSheetState } from "../state";

export const actionSheetReducer = {
  activeActionIconSheet: (state: { actionIconSheet: IActionSheetState }) => {
    state.actionIconSheet.isOpen = !state.actionIconSheet.isOpen;
  },
};
