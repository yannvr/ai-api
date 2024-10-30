import axios from 'axios'

export const fetchQuote = async (req, res) => {
  try {
    const response = await axios.get('https://zenquotes.io/api/quotes', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    console.log('xxx')
    console.log('response', response)
    res.status(200).send(response.data)
  } catch (error) {
    console.error('Error fetching the quote:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch quote',
    })
  }
}
