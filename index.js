const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const AWS = require('aws-sdk'); // AWS SDK for Filebase interaction
const { createClient } = require('@supabase/supabase-js');
require("dotenv").config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

        // Retrieve the CID from the response headers
        const cid = data.$response.httpResponse.headers['x-amz-meta-cid'];

        // Store the document metadata in Supabase
        const { data: supabaseData, error } = await supabase
            .from('documents')
            .insert([
                { viewkey: viewkey, cid: cid, signed_status: 0 }
            ]);

        if (error) {
            console.log(`Error supabase: ${error.message}`)
            throw error;
        }

        // Respond with the uploaded file's URL, CID, and metadata
        res.json({
            success: true,
            fileUrl: `https://s3.filebase.com/${params.Bucket}/${params.Key}`,
            cid: cid, // Include the CID in the response
            etag: data.ETag,
        });
    } catch (error) {
        console.log(`Error uploading file: ${error}`);
        res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
});

// Handle file read from Filebase by CID
app.get('/file', async (req, res) => {
    const cid = req.query.cid;

    try {
        const ipfs_url = "https://scared-blue-planarian.myfilebase.com/ipfs";
        // Get the file from Filebase using the CID
        const fileUrl = `${ipfs_url}/${cid}`;
        res.redirect(fileUrl); // Redirect the user to the file location on Filebase
    } catch (error) {
        console.error("Error reading file from Filebase:", error);
        res.status(500).json({ error: 'Error reading file from Filebase' });
    }
});

// Add this new route to your existing code
app.get('/documents', async (req, res) => {
    const { viewkey } = req.query;

    if (!viewkey) {
        return res.status(400).json({ error: 'Viewkey is required' });
    }

    try {
        // Query Supabase for documents with the given viewkey
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('viewkey', viewkey);

        if (error) {
            throw error;
        }

        // Return the list of documents
        res.json({ success: true, documents: data });
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ error: 'Failed to fetch documents', details: error.message });
    }
});

// Handle document signing
app.post('/sign', async (req, res) => {
    const { cid } = req.body;

    try {
        // Update the signed status in Supabase
        const { data, error } = await supabase
            .from('documents')
            .update({ signed_status: 1 })
            .eq('cid', cid);

        if (error) {
            throw error;
        }

        res.json({ success: true, message: 'Document signed successfully' });
    } catch (error) {
        console.error("Error signing document:", error);
        res.status(500).json({ error: 'Failed to sign document', details: error.message });
    }
});

app.listen(process.env.PORT || 3001, () => {
    console.log("Listening at 3001")
});

module.exports = app;