import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import ApiResponse from './models/apiResponse';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req: Request, res: Response) => {
  const response: ApiResponse = {
    statusCode: 200,
    data: 'Hello World',
    message: 'Success',
    error: null
  };
  res.json(response);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});