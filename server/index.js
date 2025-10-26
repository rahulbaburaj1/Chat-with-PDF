import express from 'express';
import cors from 'cors';
import multer from 'multer'
import {Queue} from "bullmq";
import { QdrantVectorStore } from '@langchain/qdrant';
import axios from 'axios';
import OpenAI from "openai";


const client = new OpenAI({
  baseURL: "http://10.10.8.70:11434/v1", 
  apiKey: "EMPTY",                     
});

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



const queue = new Queue("file-upload-queue",{
    connection: {
        host: "10.10.8.30",
        port: "6379",
    },
   } );

const storage = multer.diskStorage({
    destination: function (req , file, cb){
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb ) {
        const uniqueSuffix  = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});

const upload = multer({storage:storage});
const app = express();
app.use(cors());

app.get('/',(req,res) => {
    return res.json({ status: "Wonderfull"});
});


app.get('/chat', async(req,res) =>{
    const userQuery = req.query.message;
    const embeddings = new LocalEmbeddings();

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: 'http://10.10.8.30:6333',
          collectionName: 'langchainjs-testing',
        }
    );
    const ret = vectorStore.asRetriever({
        k:2,
    });
    const result = await ret.invoke(userQuery);
    //return res.json({result});

    const SYSTEM_PROMPT = `
        You are helfull AI Assistant who answeres the user query based on the available context from PDF File.
        Context:
        ${JSON.stringify(result)}
        `;

    const chatResult = await client.chat.completions.create({
        model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userQuery },
                ],

       
    });
    return res.json({
    message: chatResult.choices[0].message.content,
    docs: result,
  });

    
});












app.post('/uploads/pdf', upload.single('pdf'), async (req, res) => {
  await queue.add(
    'file-ready',
    JSON.stringify({
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path,
    }))
  return res.json({ message: 'uploaded' });
});


app.listen(8000, () => console.log(`Server started on PORT:${8000}`));
  