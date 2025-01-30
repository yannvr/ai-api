import axios from 'axios'

export const fetchQuote = async (req, res) => {
  try {
    const response = await axios.get('https://zenquotes.io/api/quotes', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    res.status(200).send(response.data)
  } catch (error) {
    console.error('Error fetching the quote:', error)
    throw new Error('Failed to fetch quote')
  }
}
