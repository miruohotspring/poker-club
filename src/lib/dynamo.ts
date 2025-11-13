import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocument,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

export const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

export const ddbDocument = DynamoDBDocument.from(ddbClient);

export const docClient = DynamoDBDocumentClient.from(ddbClient);
