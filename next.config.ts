import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingExcludes: {
    "/api/admin/products/import": ["./public/products/**/*"],
    "/app/api/admin/products/import/route": ["./public/products/**/*"],
  },
  async headers() {
    const headers = [...securityHeaders];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
  images: {
    localPatterns: [
      { pathname: "/products/**" },
      { pathname: "/categories/**" },
      { pathname: "/kolekcie/**" },
      { pathname: "/homepage/**" },
      { pathname: "/images/**" },
      { pathname: "/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.printexpert.sk",
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: "printexpert.sk",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
