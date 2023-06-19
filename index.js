const express = require('express');
const multer = require('multer');
const fs = require('fs');
const winston = require('winston');

const port = 8050;
const app = express();
const { exec } = require('child_process');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './Temp');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

const logger = winston.createLogger({
    level: 'info', 
    format: winston.format.combine(
      winston.format.timestamp(), 
      winston.format.json() 
    ),
    transports: [
      new winston.transports.Console(), 
      new winston.transports.File({ filename: 'app.log' }) 
    ]
  });

const settingsData = fs.readFileSync('./config.json');
const settings = JSON.parse(settingsData);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/examples/echo', (request, response) => {
    const text = request.query.text;
    response.send(text);
});

app.listen(port, () => {
    console.log(`server is listening at http://localhost:${port}`);
});


app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;

    try {
        const command = `${settings.libewPath} "${file.path}" -O GeoJSON -o "${file.path}.json"`;
        await executeCommand(command);

        const json = await readFileData(`${file.path}.json`)

        deleteFiles([file.path, `${file.path}.json`])
        return res.status(200).json({ json });
    } catch (error) {
        console.error(`Error executing command: ${error}`);
        logger.error(`Error executing command: ${error}`);
        return res.status(500).json({ message: 'File uploaded failed.' });
    }
});

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout);
        });
    });
}

function readFileData(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (error, data) => {
            if (error) {
                reject(error);
                return;
            }

            try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

function deleteFiles(filePaths) {
    const deletePromises = filePaths.map((filePath) => {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(filePath);
            });
        });
    });

    return Promise.all(deletePromises);
}
