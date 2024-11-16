const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron"); // For scheduling cleanup
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/compress", upload.single("image"), async (req, res) => {
  console.log("req", req);
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Determine the output format based on the uploaded file's mimetype
    const outputFormat = req.file.mimetype.split("/")[1]; // e.g., 'jpeg', 'png'
    const outputFileName = `compressed-${Date.now()}.${outputFormat}`;
    const outputPath = path.join(__dirname, "uploads", outputFileName);

    // Compress the image while keeping its original dimensions
    await sharp(req.file.buffer)
      .toFormat(outputFormat, { quality: 80 }) // Adjust quality as needed
      .toFile(outputPath);

    res.json({
      url: `${req.protocol}://${req.get("host")}/uploads/${outputFileName}`,
    });
  } catch (error) {
    console.error("Error compressing image:", error);
    res.status(500).send("Error compressing image");
  }
});

// Scheduled task to clean up old files in the uploads directory every day at midnight
cron.schedule("0 0 * * *", () => {
  fs.readdir("uploads", (err, files) => {
    if (err) throw err;

    files.forEach((file) => {
      const filePath = path.join(__dirname, "uploads", file);
      fs.stat(filePath, (err, stats) => {
        if (err) throw err;

        // Check if the file is older than 7 days (604800000 milliseconds)
        const now = Date.now();
        const fileAgeInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (fileAgeInDays > 7) {
          fs.unlink(filePath, (err) => {
            if (err) throw err;
            console.log(`Deleted old file: ${file}`);
          });
        }
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
