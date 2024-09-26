import { connectToDatabase } from '../../utils/mongodb';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error', err);
        return res.status(500).json({ error: 'Error parsing form data' });
      }

      const { db } = await connectToDatabase();
      const imageFile = files.zipfile;

      try {
        const fileContent = fs.readFileSync(imageFile.filepath);
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: `${fields.meeting_id}/${imageFile.originalFilename}`,
          Body: fileContent,
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        await db.collection('games').insertOne({
          title: fields.title,
          creator: fields.creator,
          width: parseInt(fields.width),
          height: parseInt(fields.height),
          thumbnailFile: imageFile.originalFilename,
          meetingid: fields.meeting_id,
          username: fields.username,
        });

        res.status(200).json({ message: 'File uploaded successfully', creator: fields.creator });
      } catch (error) {
        console.error('Error', error);
        res.status(500).json({ error: 'Error uploading file' });
      }
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}