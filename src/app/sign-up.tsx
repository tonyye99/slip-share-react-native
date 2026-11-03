import { AuthForm } from '@/components/auth-form'
import { strings } from '@/i18n'
import { authCallbackUrl } from '@/lib/auth-links'
import { supabase } from '@/lib/supabase'

export default function SignUpScreen() {
  return (
    <AuthForm
      mode="sign-up"
      onSubmit={async ({ name, email, password }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || undefined }, emailRedirectTo: authCallbackUrl() },
        })
        if (error) return { error: error.message }
        return data.session ? {} : { notice: strings().auth.checkEmailToConfirm }
      }}
    />
  )
}
