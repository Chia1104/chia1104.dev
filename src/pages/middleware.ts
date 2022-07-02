import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
    // if (request.nextUrl.pathname === '/login') {
    //     const url = request.nextUrl.clone()
    //     url.pathname = '/'
    //
    //     return NextResponse.redirect(url)
    // }
}

export const config = {
    // matcher: ['/login'],
}
