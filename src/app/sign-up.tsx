import { AuthForm } from '@/components/auth-form'
import { supabase } from '@/lib/supabase'

export default function SignUpScreen() {
  return (
    <AuthForm
      mode="sign-up"
      onSubmit={async ({ name, email, password }) => {
        // display_name feeds the profiles trigger in the slip-share migrations.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || undefined } },
        })
        if (error) return { error: error.message }
        // With email confirmation on, there is no session until the link is clicked.
        return data.session ? {} : { notice: 'Check your email to confirm your account, then sign in.' }
      }}
    />
  )
}
