/// <reference types="vitest" />

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
    },
    resolve: {
        alias: {
            '@chia/src': path.resolve(__dirname, './src'),
            '@chia/src/components': path.resolve(__dirname, './src/components'),
            '@chia/api': path.resolve(__dirname, './src/api'),
            '@chia/store': path.resolve(__dirname, './src/store'),
            '@chia/utils': path.resolve(__dirname, './utils'),
            '@chia/lib': path.resolve(__dirname, './lib'),
        },
    },
})
