'use client'

// React Imports
import type { FormHTMLAttributes } from 'react'

type Props = FormHTMLAttributes<HTMLFormElement>

const FormComponent = (props: Props) => {
  // Props
  const { onSubmit, ...rest } = props

  return <form {...rest} onSubmit={onSubmit ? e => onSubmit(e) : e => e.preventDefault()} />
}

export default FormComponent
