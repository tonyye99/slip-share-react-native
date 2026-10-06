import { AuthForm } from '@/components/auth-form'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  return (
    <AuthForm
      mode="sign-in"
      onSubmit={async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message }
      }}
    />
  )
}
