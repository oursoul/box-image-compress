const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

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
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        // Determine the output format based on the uploaded file's mimetype
        const outputFormat = req.file.mimetype.split("/")[1]; // e.g., 'jpeg', 'png', 'webp'
        const outputFileName = `compressed-${Date.now()}.${outputFormat}`;
        const outputPath = path.join(__dirname, "uploads", outputFileName);

        const inputBuffer = req.file.buffer;
        const originalSize = inputBuffer.length; // 原始文件大小

        // Create the image processor based on the output format
        let imageProcessor;

        switch (outputFormat) {
            case 'jpeg':
                imageProcessor = sharp(inputBuffer).jpeg({ quality: 55 }); // 优化JPEG质量
                break;
            case 'png':
                imageProcessor = sharp(inputBuffer).png({ compressionLevel: 9 }); // PNG最大压缩级别
                break;
            case 'webp':
                imageProcessor = sharp(inputBuffer).webp({ quality: 55 }); // 优化WebP质量
                break;
            default:
                return res.status(400).json({ error: 'Unsupported output format' });
        }

        await imageProcessor.toFile(outputPath);

        const compressedSize = fs.statSync(outputPath).size; // 压缩后文件大小

        console.log(`输入文件大小: ${originalSize} bytes`);
        console.log(`输出文件大小: ${compressedSize} bytes`);

        // 检查输出文件大小
        if (compressedSize >= originalSize) {
            console.warn(`警告: 输出文件大小 (${compressedSize} bytes) 大于或等于输入文件大小 (${originalSize} bytes)。`);
            // 返回原始图像的URL
            return res.json({
                url: `${req.protocol}://${req.get("host")}/uploads/${req.file.originalname}`,
                originalSize,
                compressedSize,
                compressionRatio: "0.00", // 无法计算压缩比率
                fileName: req.file.originalname,
                format: outputFormat,
            });
        }

        // 计算压缩比率
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

        res.json({
            url: `${req.protocol}://${req.get("host")}/uploads/${outputFileName}`,
            originalSize,
            compressedSize,
            compressionRatio: compressionRatio.toFixed(2), // 保留两位小数
            fileName: outputFileName,
            format: outputFormat,
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