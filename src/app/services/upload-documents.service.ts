import { HttpEventType } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { FileSystemFileEntry, NgxFileDropEntry } from 'ngx-file-drop'
import { Subscription } from 'rxjs'
import {
  ConsumerStatusService,
  FileStatusPhase,
} from './consumer-status.service'
import { DocumentService } from './rest/document.service'
import { DocumentParsingService } from './document-parsing.service'
import { IndexBuilder } from './miniwhoosh.service'

@Injectable({
  providedIn: 'root',
})
export class UploadDocumentsService {
  private uploadSubscriptions: Array<Subscription> = []

  constructor(
    private documentService: DocumentService,
    private consumerStatusService: ConsumerStatusService,
    private documentParsingService: DocumentParsingService,
    private indexBuilder: IndexBuilder
  ) { }

  onNgxFileDrop(files: NgxFileDropEntry[]) {
    for (const droppedFile of files) {
      if (droppedFile.fileEntry.isFile) {
        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry
        fileEntry.file((file: File) => this.uploadFile(file))
      }
    }
  }

  uploadFiles(files: FileList) {
    for (let index = 0; index < files.length; index++) {
      this.uploadFile(files.item(index))
    }
  }

  private uploadFile(file: File) {
    let status = this.consumerStatusService.newFileUpload(file.name)

    status.message = $localize`Processing Document...`

    this.documentParsingService.parseDocument(file)
      .then(fileInfo => {
        const metadata = fileInfo.metadata
        const content = fileInfo.content
        const fileData = {
          id: this.documentParsingService.getDocumentUUID(content),
          title: metadata["Title"],
          content: content,
          correspondent: metadata["Author"],
          type: metadata["MIME Type"],
          created: metadata["Create Date"],
          modified: metadata["Modify Date"],
          added: metadata["File Modification Date/Time"],
          page_count: metadata["Page Count"],
          original_filename: file.name
        };
        this.indexBuilder.processAndEncryptDocument(fileData, fileData.id)
          .then(({ encryptedSchemaFields, documents }) => {
            status.updateProgress(
              FileStatusPhase.UPLOADING,
              80,
              100
            )
            status.message = $localize`Uploading...`

            let payload = {
              schemaFields: this.documentParsingService.serializeSchemaFields(encryptedSchemaFields),
              documents: documents
            }

            this.uploadSubscriptions[file.name] = this.documentService
              .uploadDocument(payload)
              .subscribe({
                next: (event) => {
                  if (event.type == HttpEventType.Response) {
                    status.message = $localize`Upload complete!`
                    status.updateProgress(
                      FileStatusPhase.SUCCESS,
                      100,
                      100
                    )
                  }
                },
                error: (error) => {
                  switch (error.status) {
                    case 400: {
                      this.consumerStatusService.fail(status, error.error.document)
                      break
                    }
                    default: {
                      this.consumerStatusService.fail(
                        status,
                        $localize`HTTP error: ${error.status} ${error.statusText}`
                      )
                      break
                    }
                  }
                  this.uploadSubscriptions[file.name]?.complete()
                },
              })
          })
      });
  }
}
