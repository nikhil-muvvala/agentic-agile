const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.log("BACKEND SAYS: No file uploaded");
    return res.status(400).send("No file uploaded");
  }
  console.log("BACKEND SAYS: SUCCESS", req.file);
  res.send("Success");
});

const server = app.listen(9998, async () => {
  try {
    const api = axios.create({
      baseURL: 'http://localhost:9998',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const fd = new FormData();
    // using a dummy text file
    fs.writeFileSync('dummy.txt', 'hello');
    fd.append('file', fs.createReadStream('dummy.txt'));

    console.log("--- TEST 1: NO EXPLICIT HEADERS ---");
    try {
      await api.post('/upload', fd);
    } catch (e) { console.log(e.response ? e.response.data : e.message); }

    console.log("--- TEST 2: EXPLICIT MULTIPART ---");
    try {
      await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } catch (e) { console.log(e.response ? e.response.data : e.message); }

    console.log("--- TEST 3: AXIOS NATIVE WAY (Delete Header) ---");
    try {
      // In browser axios, omitting Content-Type by setting it to undefined/false or deleting it
      await api.post('/upload', fd, { headers: { 'Content-Type': undefined } });
    } catch (e) { console.log(e.response ? e.response.data : e.message); }

    // NOTE: FormData in Node.js (form-data package) requires you to pass fd.getHeaders() manually!
    // But in the browser, native FormData handles it. So let's test node-specific way just to see if multer works:
    console.log("--- TEST 4: NODE.JS FORM-DATA HEADERS ---");
    try {
      await api.post('/upload', fd, { headers: fd.getHeaders() });
    } catch (e) { console.log(e.response ? e.response.data : e.message); }
    
  } finally {
    server.close();
    process.exit(0);
  }
});
