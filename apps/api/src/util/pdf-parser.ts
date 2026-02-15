// Simple PDF text extractor using shell command (works everywhere)
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Write to temp file
  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `pdf-${Date.now()}.pdf`);
  const tmpTxt = path.join(tmpDir, `pdf-${Date.now()}.txt`);

  try {
    await fs.writeFile(tmpPdf, pdfBuffer);

    // Try pdftotext (most reliable)
    try {
      await execAsync(`pdftotext "${tmpPdf}" "${tmpTxt}"`);
      const text = await fs.readFile(tmpTxt, 'utf-8');
      return text;
    } catch (pdftotextError) {
      console.error(JSON.stringify({ level: 'error', context: 'PdfParser', message: 'pdftotext failed', error: String(pdftotextError) }));
      // Fallback: use strings command
      try {
        const { stdout } = await execAsync(`strings "${tmpPdf}"`);
        return stdout;
      } catch (stringsError) {
        console.error(JSON.stringify({ level: 'error', context: 'PdfParser', message: 'strings fallback also failed', error: String(stringsError) }));
        throw stringsError;
      }
    }
  } finally {
    // Cleanup
    await fs.unlink(tmpPdf).catch(() => {});
    await fs.unlink(tmpTxt).catch(() => {});
  }
}

