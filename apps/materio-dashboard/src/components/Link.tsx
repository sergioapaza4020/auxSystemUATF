'use client'

// React Imports
import { forwardRef } from 'react'
import type { ComponentProps, MouseEvent } from 'react'

// Next Imports
import NextLink from 'next/link'

type Props = Omit<ComponentProps<'a'>, 'href' | 'onClick'> & {
  href?: string
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(props, ref) {
  // Props
  const { href, onClick, ...rest } = props

  return (
    <NextLink href={href || '/'} passHref legacyBehavior>
      <a ref={ref} {...rest} onClick={onClick ? e => onClick(e) : !href ? e => e.preventDefault() : undefined} />
    </NextLink>
  )
})

export default Link
