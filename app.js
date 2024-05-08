const PORT = process.env.PORT || 8080;
import express from "express";
import ytdl from "ytdl-core";
import contentDisposition from "content-disposition";
import fluentFfmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";


const videoPath = 'tmp/video.mp4';
const audioPath = 'tmp/audio.mp3';
const mergedPath = 'tmp/out.mp4';

fluentFfmpeg.setFfmpegPath(ffmpegStatic);
if (!fs.existsSync("tmp/")) fs.mkdirSync("tmp/");

const app = express();
app.use(express.static("public"));

const optsByFormat = new Map([
  ["mp3", { format: "mp3", quality: "highestaudio", filter: "audioonly" }],
]);

const downloadAudio = async (res, req) => {
  const url = decodeURIComponent(req.query.url);

  if (!ytdl.validateURL(url)) return res.status(400).send("Invalid link!");

  const audioOpts = optsByFormat.get("mp3");
  const audioInfo = await ytdl.getInfo(url);
  const audioFormat = ytdl.chooseFormat(audioInfo.formats, audioOpts);
  const title = audioInfo.videoDetails.title;
  const filename = `${title}.mp3`;

  if (!audioFormat) {
    throw new Error("No audio format found");
  }

  res.set("Content-Length", audioFormat.contentLength);
  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Disposition", contentDisposition(filename, { type: 'attachment' }));

  ytdl(url, audioOpts).pipe(res);
};

const downloadVideo = async (res, req) => {
  const url = decodeURIComponent(req.query.url);
  const quality = req.query.quality || "highest";

  if (!ytdl.validateURL(url)) return res.status(400).send("Invalid link!");

  const videoInfo = await ytdl.getInfo(url);


  const videoFormatRaw = videoInfo.formats.find((format) => {
    if (format.height == quality) {
      return format;
    }
  });



  if (!videoFormatRaw) {
    return res.status(404).send(`No video format found for quality ${quality}`);
  }


  const videoFormat = ytdl.chooseFormat(videoInfo.formats, { quality: videoFormatRaw.itag});


  const title = videoInfo.videoDetails.title;
  const filename = `${title}.mp4`;

  if (!videoFormat) {
    return res.status(404).send(`No video format found for quality ${quality}`);
  }

  res.set("Content-Type", "video/mp4");
  res.set("Content-Disposition", contentDisposition(filename, { type: "attachment" }));

  if(videoFormat.hasAudio){
    res.set("Content-Length", videoFormat.contentLength);
    ytdl(url,{ format: videoFormat }).pipe(res);
  }

  



  const videoStream = ytdl(url,{ format: videoFormat });
  const audioStream = ytdl(url,  { quality: 'highestaudio', filter: 'audioonly'});
  const mergedStream = await mergeStreams(videoStream, audioStream);
  res.set("Content-Length", fs.statSync(mergedPath).size);
  mergedStream.pipe(res);

  mergedStream.on("end", () => {
    fs.unlinkSync(audioPath);
    fs.unlinkSync(videoPath);
    fs.unlinkSync(mergedPath);
  });

};


const downloadStreamToBuffer = async (stream) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
};

// Function to write a buffer to a file
const writeBufferToFile = async (buffer, filePath) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const mergeStreams = async (videoStream, audioStream) => {
  //put stream datas into tmp files | tmp/video.mp4 | tmp/audio.mp3
  const videoBuffer = await downloadStreamToBuffer(videoStream);
  const audioBuffer = await downloadStreamToBuffer(audioStream);
  await writeBufferToFile(videoBuffer, videoPath);
  await writeBufferToFile(audioBuffer, audioPath);
  //create file on mergedPath
  fs.closeSync(fs.openSync(mergedPath, 'w'));


  //merge streams

  await new Promise((resolve, reject) => {
    fluentFfmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy", // Video codec: Copy (no re-encoding)
        "-c:a aac", // Audio codec: AAC
        "-b:a 192k", // Audio bitrate: 192 kbps
        "-shortest" // Output stops when the shortest input stream ends
      ])
      .output(mergedPath)
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        console.log("An error happened: " + err.message);
        reject(err);
      })
      .run();
  });

  return fs.createReadStream(mergedPath);

};



app.get("/download/:format", async (req, res) => {
  const format = req.params.format;

  if (!["audio", "video"].includes(format)) {
    return res.status(400).send("Invalid format");
  }

  if (format === "audio") {
    await downloadAudio(res, req);
  } else {
    await downloadVideo(res, req);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
