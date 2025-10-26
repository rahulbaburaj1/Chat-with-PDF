import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
const worker = new Worker(
    'file-upload-queue',
    async (job) => {
        console.log(`JOB:`, job.data);
        const data = JSON.parse(job.data);
        const loader = new PDFLoader(data.path);
        const docs = await loader.load();
        console.log(`Docs:`,docs);
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,      // ~1000 characters per chunk
            chunkOverlap: 200,    // overlap between chunks
            });
        const splitDocs = await splitter.splitDocuments(docs);
        console.log(`Split into ${splitDocs.length} chunks`);
        console.log('Example chunk:', splitDocs[0]);


    },
    {concurrency: 500, connection: {
        host: "10.10.8.30",
        port: "6379",
    }}
);

