export const actionSheetReducer = {
    activeActionIconSheet: (state: any) => {
        state.actionIconSheet.isOpen = !state.actionIconSheet.isOpen;
    }
}
