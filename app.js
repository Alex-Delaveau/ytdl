const PORT = process.env.PORT || 3000;
const express = require("express");
const ytdl = require("ytdl-core");
const contentDisposition = require("content-disposition");

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
  console.log(title)

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
    if (format.qualityLabel === quality + 'p') {
      return format;
    }
  });

  const videoFormat = ytdl.chooseFormat(videoInfo.formats, { quality: videoFormatRaw.itag});


  const title = videoInfo.videoDetails.title;
  const filename = `${title}.mp4`;

  if (!videoFormat) {
    return res.status(404).send(`No video format found for quality ${quality}`);
  }

  res.set("Content-Type", "video/mp4");
  res.set("Content-Disposition", contentDisposition(filename, { type: "attachment" }));
  res.set("Content-Length", videoFormat.contentLength);

  if(!videoFormat.hasAudio){
    //treat audio and video separately using ffmpeg
  }


  ytdl(url,{ format: videoFormat }).pipe(res);
};

app.get("/download/:format", async (req, res) => {
  const format = req.params.format;

  if (!["mp3", "mp4"].includes(format)) {
    return res.status(400).send("Invalid format");
  }

  if (format === "mp3") {
    await downloadAudio(res, req);
  } else {
    await downloadVideo(res, req);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
