const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const AWS = require('aws-sdk'); // AWS SDK for Filebase interaction
require("dotenv").config();

// Set up Filebase configuration (similar to AWS S3)
const s3 = new AWS.S3({
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,  // Your Filebase Access Key
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,  // Your Filebase Secret Key
    endpoint: new AWS.Endpoint('https://s3.filebase.com'), // Filebase endpoint
    region: 'us-east-1', // Filebase region
    s3ForcePathStyle: true,  // Needed for Filebase compatibility
    signatureVersion: 'v4'
});

// Set up multer for file upload handling
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });


app.use(express.static('public'))
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true }))
app.use(cors({
    origin: '*'
}));


app.get('/', async (req, res) => {
    res.json("Hello Zk sign Aleo")
})

// Handle file upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        // Validate file data and viewkey
        const { file, viewkey } = req.body;
        if (!file || !viewkey) {
            return res.status(400).json({ error: 'File data and viewkey are required' });
        }

        // Decode file data (assumes it's base64-encoded in the request)
        const fileBuffer = Buffer.from(file, 'base64');

        // Construct S3 parameters
        const timestamp = Date.now();
        const params = {
            Bucket: process.env.FILEBASE_BUCKET, // Ensure this is set in your environment variables
            Key: `${timestamp}`, // File key is now just a timestamp
            Body: fileBuffer,
            ContentType: req.headers['content-type'] || 'application/octet-stream', // Use client-provided or default MIME type
            ACL: 'public-read', // Make the file publicly accessible
            Metadata: {
                viewkey: viewkey, // Attach the viewkey as metadata
            },
        };

        // Upload to S3/Filebase
        const data = await s3.putObject(params).promise();

        // Respond with the uploaded file's URL and metadata
        res.json({
            success: true,
            fileUrl: `https://s3.filebase.com/${params.Bucket}/${params.Key}`,
            etag: data.ETag,
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
});

// Handle file read from Filebase by CID
app.get('/file', async (req, res) => {
    const cid = req.query.cid

    try {
        const ipfs_url = "https://scared-blue-planarian.myfilebase.com/ipfs"
        // Get the file from Filebase using the CID
        const fileUrl = `${ipfs_url}/${cid}`;
        res.redirect(fileUrl); // Redirect the user to the file location on Filebase
    } catch (error) {
        console.error("Error reading file from Filebase:", error);
        res.status(500).json({ error: 'Error reading file from Filebase' });
    }
});

app.listen(process.env.PORT || 3001, () =>{
    console.log("Listening at 3001")
});

module.exports = app;