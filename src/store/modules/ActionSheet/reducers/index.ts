import { IActionSheetState } from "@chia/store/modules/ActionSheet/state";

export const actionSheetReducer = {
  activeActionIconSheet: (state: { actionIconSheet: IActionSheetState }) => {
    state.actionIconSheet.isOpen = !state.actionIconSheet.isOpen;
  },
};
