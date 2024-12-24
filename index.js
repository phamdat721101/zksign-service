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
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const params = {
        Bucket: process.env.FILEBASE_BUCKET, // Your Filebase bucket name
        Key: `${Date.now()}-${req.file.originalname}`, // Use a timestamp to prevent overwriting
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read' // Make the file publicly accessible
    };

    try {

        s3.putObject(params, (err, data) => {
            if (err) {
                console.error("Error uploading to Filebase:", err);
                return res.status(500).json({ error: 'Error uploading file to Filebase' });
            }

            console.log('Headers:', data); // Check headers here

            res.json({
                success: true,
                fileUrl: `https://s3.filebase.com/${params.Bucket}/${params.Key}`,
                etag: data.ETag,
                headers: data.ResponseMetadata // Response metadata
            });
        });
    } catch (error) {
        console.error("Error uploading to Filebase:", error);
        res.status(500).json({ error: 'Error uploading file to Filebase' });
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