export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const { severity } = req.body
  const risk_score = typeof severity === 'number' ? severity * 20 : null
  res.status(200).json({ risk_score })
}
