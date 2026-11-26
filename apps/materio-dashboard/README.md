This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Transporte de autenticación

Configura el mismo `AUTH_TRANSPORT_KEY` en el entorno de ejecución de Next y
Nest. Genera 32 bytes aleatorios en hexadecimal con
`node -p "require('node:crypto').randomBytes(32).toString('hex')"`. Mantén la
clave en el gestor de secretos de ambos servicios y fuera de variables
`NEXT_PUBLIC_*`, imágenes, logs y trazas. Configura en Next
`AUTH_PUBLIC_ORIGIN` con el origen del navegador y `AUTH_API_ORIGIN` con el
origen de Nest. En producción ambos deben usar HTTPS. El proxy de Next debe
preservar el encabezado `Host` público. Coordina la configuración y la
rotación de la clave en los dos servicios.

El navegador usa `/api/auth/login`, `/api/auth/refresh` y
`/api/auth/logout` en Next. Next valida origen y CSRF, se autentica ante
Nest con `x-uatf-auth-transport`, entrega únicamente el access token en
el JSON y guarda el refresh en una cookie HttpOnly. CORS controla el acceso
desde scripts de otros orígenes. Nest comprueba la credencial de transporte
también en llamadas directas sin navegador.

Los endpoints legacy de Nest requieren una clave independiente
`AUTH_LEGACY_TRANSPORT_KEY` y quedan deshabilitados cuando está vacía.
Configúrala únicamente para servidores legacy autorizados que necesiten
acceso temporal. La ventana termina el 8 de diciembre de 2026 a las
00:00 UTC y puede acortarse con `AUTH_LEGACY_TRANSPORT_UNTIL`. El login
legacy entrega el refresh en JSON únicamente a ese consumidor. Su refresh
entrega solo un access token y rechaza tokens del transporte HttpOnly. Las
cookies históricas elegibles se pueden migrar por Next durante su vigencia,
independientemente del cierre de esas rutas.

El refresh sigue siendo una credencial de portador. HttpOnly impide su
lectura desde scripts del navegador. Un cliente que controla su propia
respuesta HTTP puede leer su propio `Set-Cookie`. Si se compromete un
servidor autorizado o su clave, rota la clave y evalúa revocar las sesiones
afectadas. Evita registrar encabezados, cookies y cuerpos de autenticación.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
