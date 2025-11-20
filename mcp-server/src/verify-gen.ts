
import { ProgressiveDisclosureGenerator } from './progressive-disclosure.js';
import * as fs from 'fs';
import * as path from 'path';

async function verifyGeneration() {
    console.log('Initializing ProgressiveDisclosureGenerator...');
    const generator = new ProgressiveDisclosureGenerator();

    console.log('Generating API...');
    await generator.generateAPI();

    console.log('API Generation complete.');

    // Check if files exist
    const serversDir = path.resolve(process.cwd(), 'servers');
    if (!fs.existsSync(serversDir)) {
        console.error('Error: servers directory not created');
        process.exit(1);
    }

    const indexFile = path.join(serversDir, 'index.ts');
    if (!fs.existsSync(indexFile)) {
        console.error('Error: servers/index.ts not created');
        process.exit(1);
    }

    const indexContent = fs.readFileSync(indexFile, 'utf-8');
    if (!indexContent.includes('discoverTools')) {
        console.error('Error: discoverTools not found in index.ts');
        process.exit(1);
    }

    if (indexContent.includes('this.toolRegistry')) {
        console.error('Error: discoverTools still contains this.toolRegistry');
        process.exit(1);
    }

    console.log('Verification successful: API generated and discoverTools looks correct.');
}

verifyGeneration().catch(console.error);
