import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
// import { create } from 'ipfs-http-client';
const { create } = require('ipfs-http-client');
const app = express();
const PORT = 3000;

// Configure Multer for file uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
});

// IPFS client setup
const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
});

// Helper function for encryption
const encryptFile = (data: Buffer, viewKey: string): Buffer => {
  const cipher = crypto.createCipher('aes-256-cbc', viewKey);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return encrypted;
};

// Helper function for decryption
const decryptFile = (data: Buffer, viewKey: string): Buffer => {
  const decipher = crypto.createDecipher('aes-256-cbc', viewKey);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted;
};

// Route to upload and encrypt file
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const viewKey = req.body.viewKey;

    if (!file || !viewKey) {
      return res.status(400).json({ error: 'File and viewKey are required' });
    }

    const fileBuffer = Buffer.from(file.buffer);
    const encryptedFile = encryptFile(fileBuffer, viewKey);

    const ipfsResult = await ipfs.add(encryptedFile);

    res.json({
      message: 'File uploaded and encrypted successfully',
      ipfsHash: ipfsResult.path,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload file to IPFS' });
  }
});

// Route to download and decrypt file
app.get('/download/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const viewKey = req.query.viewKey as string;

        if (!hash || !viewKey) {
        return res.status(400).json({ error: 'IPFS hash and viewKey are required' });
        }

        const ipfsFile = await ipfs.cat(hash);
        const chunks: Buffer[] = [];

        for await (const chunk of ipfsFile) {
        chunks.push(Buffer.from(chunk)); // Convert Uint8Array to Buffer
        }

        const encryptedBuffer = Buffer.concat(chunks);
        const decryptedFile = decryptFile(encryptedBuffer, viewKey);

        res.setHeader('Content-Disposition', `attachment; filename="decrypted_file"`);
        res.send(decryptedFile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to download or decrypt file from IPFS' });
    }
});

app.get("/", async (req, res) =>{
    res.send("Hello Aleo to PQD")
})
  

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
