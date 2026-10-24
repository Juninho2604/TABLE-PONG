/** @type {import('next').NextConfig} */

// Cabeceras de seguridad aplicadas a todas las respuestas
const securityHeaders = [
    // Evita que el sitio se incruste en iframes de terceros (clickjacking)
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
    // Fuerza HTTPS durante 2 años
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    // Impide que el navegador "adivine" tipos de archivo
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
        typedRoutes: false,
    },
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

module.exports = nextConfig;
