import { VariantType, useSnackbar } from 'notistack';

const useToast = (message?: string | 'Toast Message', variant?: VariantType | 'default') => {
    const { enqueueSnackbar } = useSnackbar();
    return enqueueSnackbar(message, { variant });
}

export default useToast;
