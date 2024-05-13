const functions = require("firebase-functions");
const axios = require("axios");
const Busboy = require("busboy");
const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const os = require("os");
const path = require("path");
const fs = require("fs");
const cors = require("cors")({ origin: true });
require("dotenv").config();

exports.analyzeImage = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    console.log("CORS headers set:", res.getHeaders());

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const busboy = new Busboy({ headers: req.headers });
    const tmpdir = os.tmpdir();

    let imageFilePath;
    let saveToFile;

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      const filepath = path.join(tmpdir, filename);
      saveToFile = fs.createWriteStream(filepath);
      file.pipe(saveToFile);
      imageFilePath = filepath;
    });

    busboy.on("finish", async () => {
      const imageAsBase64 = fs.readFileSync(imageFilePath, "base64");
      const api_key = process.env.API_KEY;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      };

      const payload = {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
          Analyze the attached image of a room. Determine whether the room is clean or messy. Based on your assessment, follow the instructions below:
          
          - If the room is clean: Give a complimentary remark. State that the room is clean. Do not make any other comments
          
          - If the room is messy: Provide constructive suggestions on things to work on to clean it up. Include specific advice tailored to what you observe in the image. Make each of the sentences in a bulleted list.
          
          Example responses based clean room:
          
          1. "Congratulations! Your room is remarkably clean.

          2. "Way to go! Your room is spotless and well-organized.

          3. "Great job on keeping your room clean and tidy.

          Example responses messy room:
          
          1. "Your room is a bit messy. 
            * To improve, you could start by organizing the books and magazines scattered on the floor. 
            * Also, hanging up the clothes draped over the chair would make a big difference. 
            * Dont forget to clear the clutter on the desk to make your workspace more inviting and productive."
          
          2. "It looks like your room could use some tidying up. 
            * Consider starting with the basics: making your bed and putting away any laundry. 
            * The next step could be to vacuum the floor and dust the surfaces. 
            * Organizing your shelves and drawers could also help in reducing the clutter and making your space feel more peaceful and enjoyable."
          
          `,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageAsBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      };

      try {
        const response = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          payload,
          { headers }
        );
        res.json(response.data);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error analyzing the image");
      }
    });

    busboy.end(req.rawBody);
  });
});
