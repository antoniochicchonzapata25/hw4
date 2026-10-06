import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { LogoMark } from '../../brand/Logo'

/** Card layout shared by the Log in and Create account pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="section container">
      <div className="account-card">
        <LogoMark size={60} className="account-card__mark" title="Campus Customs" />
        <h1 className="account-card__title">{title}</h1>
        <p className="account-card__text">{subtitle}</p>
        {children}
      </div>
    </section>
  )
}

/** Shown on /login and /create-account when someone is already signed in. */
export function AlreadySignedIn() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <AuthCard title={`Hi, ${user.first_name}!`} subtitle={`You're signed in as ${user.email}.`}>
      <div className="account-card__actions">
        <Link to="/products" className="btn btn--primary">
          Continue shopping
        </Link>
        <button type="button" className="btn btn--ghost" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </AuthCard>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  name: string
  error?: string
  hint?: string
}

export function Field({ label, name, error, hint, type = 'text', ...rest }: FieldProps) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label htmlFor={name} className="field__label">
        {label}
      </label>
      <div className="field__control">
        <input
          id={name}
          name={name}
          type={isPassword && show ? 'text' : type}
          className="field__input"
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="field__reveal"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${name}-error`} className="field__error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="form-alert" role="alert">
      {children}
    </div>
  )
}
