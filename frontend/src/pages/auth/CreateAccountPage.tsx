import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { MIN_PASSWORD } from '../../auth/authApi'
import { AlreadySignedIn, AuthCard, Field, FormAlert } from './AuthShell'

type FormState = {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm: string
}
type Errors = Partial<Record<keyof FormState, string>>

const EMPTY: FormState = { first_name: '', last_name: '', email: '', password: '', confirm: '' }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function validate(f: FormState): Errors {
  const e: Errors = {}
  if (!f.first_name.trim()) e.first_name = 'Enter your first name.'
  if (!f.last_name.trim()) e.last_name = 'Enter your last name.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`
  if (!f.confirm) e.confirm = 'Confirm your password.'
  else if (f.confirm !== f.password) e.confirm = 'Passwords do not match.'
  return e
}

export default function CreateAccountPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user && !submitting) return <AlreadySignedIn />

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return
    setSubmitting(true)
    try {
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: err.message })
      } else {
        setServerError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Create account" subtitle="Join Campus Customs to save your chats and get personal help.">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <div className="auth-form__row">
          <Field
            label="First name"
            name="first_name"
            autoComplete="given-name"
            value={form.first_name}
            onChange={set('first_name')}
            error={errors.first_name}
            maxLength={50}
            required
          />
          <Field
            label="Last name"
            name="last_name"
            autoComplete="family-name"
            value={form.last_name}
            onChange={set('last_name')}
            error={errors.last_name}
            maxLength={50}
            required
          />
        </div>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          required
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          required
        />
        <button type="submit" className="btn btn--primary btn--large auth-form__submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthCard>
  )
}
