import { Worker } from 'bullmq';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { QdrantVectorStore } from '@langchain/qdrant';
import axios from 'axios'; // ✅ Add this import

class LocalEmbeddings {
  async embedDocuments(texts) { // texts is already an array of strings
    try {
      const response = await axios.post('http://10.10.8.70:8081/embed', {
        texts: texts, // ✅ No need to map
      });
      return response.data.embeddings;
    } catch (error) {
      console.error('Error embedding documents:', error.message);
      throw error;
    }
  }
  
  async embedQuery(text) {
    try {
      const response = await axios.post('http://10.10.8.70:8081/embed', {
        texts: [text],
      });
      return response.data.embeddings[0];
    } catch (error) {
      console.error('Error embedding query:', error.message);
      throw error;
    }
  }
}

const worker = new Worker(
  'file-upload-queue',
  async (job) => {
    try {
      console.log('JOB:', job.data);
      const data = JSON.parse(job.data);

      const loader = new PDFLoader(data.path);
      const docs = await loader.load();
      console.log(`Loaded ${docs.length} pages from PDF`);

      const fullText = docs.map(d => d.pageContent).join('\n');
      const mergedDocs = [new Document({ pageContent: fullText })];

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 384,       
        chunkOverlap: 50,     
        separators: [
          "\n\n",              
          "\n",                
          ". ",                
          "! ",
          "? ",
          "; ",
          ": ",
          ", ",
          " ",
          ""
        ],
      });

      // const splitter = new RecursiveCharacterTextSplitter({
      //   chunkSize: 1000,       
      //   chunkOverlap: 200,     
      //   separators: [
      //     "\n\n", "\n", ".", "!", "?", ":", ";", ",", " ", "" 
      //   ],
      // });

      const splitDocs = await splitter.splitDocuments(mergedDocs);
      console.log(`Created ${splitDocs.length} chunks from the PDF`);

      if (splitDocs.length > 0) {
        console.log("🔹 First chunk sample:\n", splitDocs[0]?.pageContent.substring(0, 200));
      }

      const embeddings = new LocalEmbeddings();
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: 'http://10.10.8.30:6333',
          collectionName: 'langchainjs-testing',
        }
      );
      
      // ✅ Add the split documents, not the original docs
      await vectorStore.addDocuments(splitDocs);
      console.log(`✅ Successfully added ${splitDocs.length} chunks to vector store`);

    } catch (error) {
      console.error('❌ Error processing job:', error);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    concurrency: 500,
    connection: {
      host: "10.10.8.30",
      port: "6379",
    },
  }
);

worker.on('completed', job => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});