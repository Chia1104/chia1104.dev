export interface IActionSheetState {
    isOpen: boolean;
}

export const actionSheetInitState = {
    actionIconSheet: {
        isOpen: false,
    } as IActionSheetState,
}
