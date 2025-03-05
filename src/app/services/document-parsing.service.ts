import { Injectable } from '@angular/core';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { SchemaFields } from '../utils/miniwhoosh';
import { v5 as uuidv5 } from 'uuid';
import { environment } from 'src/environments/environment'

// Use assets worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/assets/pdfjs/pdf.worker.min.mjs`;

export type FileInfo = {
  content: string,
  metadata: Record<string, string>
}

const NAMESPACE = uuidv5(environment.apiBaseUrl, "6ba7b811-9dad-11d1-80b4-00c04fd430c8") // URL Namespace (see: https://www.rfc-editor.org/rfc/rfc4122#appendix-C)

@Injectable({
  providedIn: 'root'
})
export class DocumentParsingService {

  constructor() { }

  getDocumentUUID(content: string): string {
    return uuidv5(content, NAMESPACE);
  }

  serializeSchemaFields(schemaFields: SchemaFields): Record<string, Record<string, string[]>> {
    const serializableSchemaFields: Record<string, Record<string, string[]>> = {};

    for (const field in schemaFields) {
      serializableSchemaFields[field] = {};
      for (const token in schemaFields[field]) {
        serializableSchemaFields[field][token] = Array.from(schemaFields[field][token]);
      }
    }

    return serializableSchemaFields;
  }

  async getFileInfo(fileBuffer: ArrayBuffer): Promise<Record<string, string>> {
    const info = await (window as any).electron.getFileInfo(fileBuffer);
    const metadata: Record<string, string> = {};

    const lines = info.split('\n');
    for (const line of lines) {
      const match = line.match(/^(.+?)\s+:\s+(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        metadata[key] = value;
      }
    }

    return metadata;
  }

  async parseDocument(file: File): Promise<FileInfo> {
    const buffer = await file.arrayBuffer();
    const metadata = await this.getFileInfo(buffer);
    try {
      const content = await (window as any).electron.parseDocument(buffer);
      if (content?.trim()) {
        return {
          content: content,
          metadata: metadata
        }
      }
      throw new Error('Empty text from pdftotext - falling back to OCR.');
    } catch (error) {
      console.warn(`pdftotext failed: ${(error as Error).message}. Falling back to OCR.`);
      return {
        content: await this.extractTextFromPdf(file),
        metadata: metadata
      }
    }
  }

  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => console.info(m) // Logs progress
      });
      return text;
    } catch (error) {
      console.error("OCR error:", error);
      throw new Error(error);
    }
  }

  // TODO: this is not fast enough. for a document with 19 pages it takes ~2 minutes to process all the text
  // check out the tesseract docs on performance: https://github.com/naptha/tesseract.js/blob/master/docs/performance.md
  async extractTextFromPdf(pdfFile: File): Promise<string> {
    const pdfData = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    const pageTextPromises: Promise<string>[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      pageTextPromises.push(this.processPdfPage(pdf, i));
    }

    // Process all pages in parallel
    const pagesText = await Promise.all(pageTextPromises);

    // Join all page texts together (unordered)
    const fullText = pagesText.join('');

    return fullText;
  }

  private async processPdfPage(pdf: any, pageNumber: number): Promise<string> {
    try {
      const page = await pdf.getPage(pageNumber);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      const imageDataUrl = canvas.toDataURL('image/png');

      const text = await this.extractTextFromImage(imageDataUrl);
      return text;
    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error);
      return `Page ${pageNumber}: Error processing page.`;
    }
  }
}
