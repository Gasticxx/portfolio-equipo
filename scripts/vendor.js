import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const vendorDir = path.join(rootDir, 'src', 'public', 'vendor');

fs.mkdirSync(vendorDir, { recursive: true });

const filesToCopy = [
    {
        src: path.join(rootDir, 'node_modules', 'bootstrap', 'dist', 'css', 'bootstrap.min.css'),
        dest: path.join(vendorDir, 'bootstrap.min.css'),
    },
    {
        src: path.join(rootDir, 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.bundle.min.js'),
        dest: path.join(vendorDir, 'bootstrap.bundle.min.js'),
    },
    {
        src: path.join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'),
        dest: path.join(vendorDir, 'chart.umd.js'),
    },
];

for (const item of filesToCopy) {
    if (!fs.existsSync(item.src)) {
        console.error(`[assets] No se encontro el archivo origen: ${item.src}`);
        process.exit(1);
    }
    fs.copyFileSync(item.src, item.dest);
}

console.log('[assets] Librerias copiadas correctamente a src/public/vendor');