import { Injectable } from '@angular/core';
import { schema, MiniwhooshDocument, SchemaFields } from '../utils/miniwhoosh';

@Injectable({
    providedIn: 'root'
})
export class IndexBuilder {

    constructor() { }

    async processAndEncryptDocument(documentData: Record<string, string | number | boolean>, docId: string) {
        const { schemaFields, documents } = this.addDocument(documentData, docId);

        try {
            const encryptedSchemaFields = await this.encryptSchemaFields(schemaFields);

            return {
                encryptedSchemaFields,
                documents: documents
            };
        } catch (err) {
            console.error('Failed to encrypt schema fields:', err);
            throw err;
        }
    }


    addDocument(documentData: Record<string, string | number | boolean>, docId: string) {
        let schemaFields = {};
        let documents = [];

        for (const field in schema) {
            schemaFields[field] = {};
        }

        const doc: MiniwhooshDocument = {
            id: docId,
            content: {}
        };

        for (const field in schema) {
            const value = documentData[field]?.toString() ?? "";
            doc.content[field] = value;

            const tokenizer = schema[field].tokenizer;
            const tokens = tokenizer.tokenize(value);

            for (const token of tokens) {
                if (!schemaFields[field][token]) {
                    schemaFields[field][token] = new Set();
                }
                schemaFields[field][token].add(docId);
            }
        }

        const { content, ...documentWithoutContent } = documentData;
        documents.push({
            id: docId,
            ...documentWithoutContent
        } as MiniwhooshDocument);

        return {
            schemaFields: schemaFields,
            documents: documents
        };
    }

    async encryptSchemaFields(schemaFields: Record<string, Record<string, Set<string>>>): Promise<Record<string, Record<string, Set<string>>>> {
        const keywords = new Set<string>();

        for (const field in schemaFields) {
            for (const keyword of Object.keys(schemaFields[field])) {
                keywords.add(keyword);
            }
        }

        // Batch request to encrypt all keywords at once
        const encryptedKeywordsMap = await (window as any).electron.batchEncrypt(Array.from(keywords));

        const encryptedSchemaFields: Record<string, Record<string, Set<string>>> = {};

        for (const field in schemaFields) {
            encryptedSchemaFields[field] = {};

            for (const keyword of Object.keys(schemaFields[field])) {
                const encryptedKeyword = encryptedKeywordsMap[keyword];
                if (encryptedKeyword) {
                    encryptedSchemaFields[field][encryptedKeyword] = schemaFields[field][keyword];
                } else {
                    console.warn(`No encrypted value for keyword '${keyword}'`);
                }
            }
        }

        return encryptedSchemaFields;
    }
}