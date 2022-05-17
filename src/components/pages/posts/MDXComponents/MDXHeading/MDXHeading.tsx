import { Typography } from "@mui/material";

export const H1 = (props: any) => {
    return <Typography {...props} component="h1" variant="h1" className="text-4xl my-5"/>
}
export const H2 = (props: any) => {
    return <Typography {...props} component="h2" variant="h2" className="text-3xl my-4"/>
}
export const H3 = (props: any) => {
    return <Typography {...props} component="h3" variant="h3" className="text-2xl my-3"/>
}
export const H4 = (props: any) => {
    return <Typography {...props} component="h4" variant="h4" className="text-xl my-2"/>
}
export const H5 = (props: any) => {
    return <Typography {...props} component="h5" variant="h5" className="text-lg my-2"/>
}
export const H6 = (props: any) => {
    return <Typography {...props} component="h6" variant="h6" className="text-sm my-2"/>
}
