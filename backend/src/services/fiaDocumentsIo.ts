import axios from 'axios';
import { spawn } from 'child_process';

// The real network and PDF access for the weekend flags watcher. Kept apart from the logic so the
// logic is tested with fakes.

const LISTING_URL = 'https://www.fia.com/documents/championships/fia-formula-one-world-championship-14';
const USER_AGENT = 'Mozilla/5.0 (compatible; PoulePositionBot/1.0; +https://pouleposition.nl)';
const FIA_HOST = 'www.fia.com';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_LISTING_BYTES = 5 * 1024 * 1024;

export const fetchFiaListing = async (): Promise<string> => {
  const res = await axios.get<string>(LISTING_URL, {
    timeout: 15_000,
    responseType: 'text',
    maxContentLength: MAX_LISTING_BYTES,
    headers: { 'User-Agent': USER_AGENT },
  });
  return res.data;
};

export type Download = (url: string) => Promise<Buffer>;

const downloadPdf: Download = async (url) => {
  const res = await axios.get<ArrayBuffer>(url, {
    timeout: 20_000,
    responseType: 'arraybuffer',
    maxContentLength: MAX_PDF_BYTES,
    maxRedirects: 0, // an FIA document is served from where the listing says; no redirect to elsewhere
    headers: { 'User-Agent': USER_AGENT },
  });
  return Buffer.from(res.data);
};

// pdftotext (poppler) reads the PDF from stdin and writes the text, keeping the table layout.
export const pdfBufferToText = (pdf: Buffer, tool = 'pdftotext'): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(tool, ['-layout', '-', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let size = 0;
    let finished = false;
    const finish = (error: Error | null, text?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(text ?? '');
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('pdftotext timed out'));
    }, 15_000);

    child.on('error', (error) => finish(error)); // for example ENOENT when the tool is not installed
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('pdftotext produced too much text'));
        return;
      }
      out.push(chunk);
    });
    child.on('close', (code) => {
      if (code === 0) finish(null, Buffer.concat(out).toString('utf8'));
      else finish(new Error(`pdftotext failed with code ${code}`));
    });
    child.stdin.on('error', () => undefined); // the tool may exit before reading everything
    child.stdin.end(pdf);
  });

// Only documents on fia.com are fetched: the URLs come from a web page, so they are data, not trusted.
export const fetchFiaPdfText = async (url: string, download: Download = downloadPdf): Promise<string> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Not an FIA document URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== FIA_HOST) throw new Error('Not an FIA document URL');

  const pdf = await download(url);
  if (pdf.length > MAX_PDF_BYTES) throw new Error('The document is too large');
  if (!pdf.subarray(0, 5).toString('latin1').startsWith('%PDF')) throw new Error('The download is not a PDF');
  return pdfBufferToText(pdf);
};
