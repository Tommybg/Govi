/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
      const endpoint = process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT;
      if (!endpoint) {
        console.warn('Warning: NEXT_PUBLIC_CONN_DETAILS_ENDPOINT is not defined');
        return [];
      }
      
      return [
        {
          source: '/api/:path*',
          destination: `${endpoint}/api/:path*`,
        },
      ];
    },
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'Access-Control-Allow-Credentials', value: 'true' },
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
            { key: 'Access-Control-Allow-Headers', value: 'Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date' },
          ],
        },
      ];
    },
  };
  
  // Using ES modules export instead of CommonJS
  export default nextConfig;