import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const filePath = path.join(process.cwd(), 'public', 'mocks', 'events.json')
  const data = await fs.readFile(filePath, 'utf-8')
  res.setHeader('Content-Type', 'application/json')
  res.status(200).send(data)
}
