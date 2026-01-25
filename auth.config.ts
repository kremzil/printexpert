import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')
      const isOnAccount = nextUrl.pathname.startsWith('/account')
      
      if (isOnAdmin) {
        if (!isLoggedIn) return false
        if (auth.user.role !== 'ADMIN') {
          return Response.redirect(new URL('/', nextUrl))
        }
        return true
      }
      
      if (isOnAccount && !isLoggedIn) {
        return false
      }
      
      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
