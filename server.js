const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Allow requests from your Vercel frontend
app.use(cors({ origin: '*' }));
app.use(express.json());

// Folder to temporarily store clips
const OUTPUT_DIR = path.join(__dirname, 'clips');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Health check route
app.get('/', (req, res) => {
  res.json({ message: '🎬 QuickClip backend is running!' });
});

// Main clip route
app.post('/api/clip', (req, res) => {
  const { url, startTime, endTime, quality } = req.body;

  // Validate inputs
  if (!url || !startTime || !endTime) {
    return res.status(400).json({
      error: 'URL, start time, and end time are required.'
    });
  }

  // Map quality label to yt-dlp format string
  const qualityMap = {
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]',
    '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]',
    'Auto':  'bestvideo+bestaudio/best'
  };

  const format = qualityMap[quality] || qualityMap['Auto'];
  const filename = `quickclip_${uuidv4()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  // Build the yt-dlp command
  const command = `yt-dlp -f "${format}" --download-sections "*${startTime}-${endTime}" --merge-output-format mp4 -o "${outputPath}" "${url}"`;

  console.log(`⏳ Clipping: ${url} [${startTime} → ${endTime}]`);

  // Run the command (5 minute timeout)
  exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ yt-dlp error:', stderr);
      return res.status(500).json({
        error: 'Failed to process video. Please check the link and try again.'
      });
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({
        error: 'Clip was not created. Please try again.'
      });
    }

    // Send the file to the user
    const downloadName = `quickclip_${startTime.replace(/:/g, '-')}_to_${endTime.replace(/:/g, '-')}.mp4`;

    res.download(outputPath, downloadName, (err) => {
      // Delete the file after download to save space
      fs.unlink(outputPath, () => {});
      if (err) console.error('Download error:', err);
    });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 QuickClip backend running on port ${PORT}`);
});
