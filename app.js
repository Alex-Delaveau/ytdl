//Create basic webserver with 2 endpoints /download/${format}/?url=${encodeURIComponent(url)}&quality=${quality} with format being mp3 or mp4
//get port from PORT .env
const PORT = process.env.PORT || 3000;
const express = require("express");
const ytdl = require("ytdl-core");

const app = express();
app.use(express.static("public"));

app.get("/download/:format", async (req, res) => {
  const { url, quality } = req.query;
  const format = req.params.format;
  console.log(url, quality, format);
  // Intégrer votre logique pour traiter la demande de téléchargement
  // const videoInfo = await (await ytdl.getBasicInfo(decodeURIComponent(url))).formats
  if (format === "mp3") {
    //res send the result of the promise from downloadAudio
    const stream = await downloadAudio(url);
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Disposition", "attachment; filename=audio.mp3");
    console.log(stream)
    res.send(stream)
  }
  // Simuler une réponse
  
});

const optsByFormat = new Map([
  // maps container to ytdl-core `ytdl` options
  ["mp3", { format: "mp3", quality: "highestaudio", filter: "audioonly" }],
  ["mp4", { format: "mp4", quality: "highest" }],
]);

const downloadAudio = async (url) => {
  //Get content length

  const info = await ytdl.getInfo(url);
  const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
  const itag = format.itag;

  //Download audio using itag 

   return ytdl(url, { filter: (format) => format.itag === itag });
};

app.get("", (req, res) => {
  res.send("Hello World");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
