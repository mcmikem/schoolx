import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { apiError, apiSuccess, handleApiError, withSecurity } from '@/lib/api-utils'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const promptTemplate = `
You are a robust data extraction parser for a School Management System. 
The user is going to paste raw text copied from an Excel spreadsheet, a Word document, or a messy email. 
Your job is to extract all the valid students from this raw text and return them strictly as a JSON array of objects.

Extract the following fields for each student:
- "first_name": (string, required)
- "last_name": (string, required)
- "gender": (string, "M" or "F" only)
- "class_name": (string, required, e.g., "P.1", "S.4", "Primary 5")
- "parent_name": (string, guess from context if there's an adult name)
- "parent_phone": (string, extract the main phone number)

Try your best to guess gender from names if it's missing but obvious. Standardize classes to "P.X" or "S.X" format where possible. 
Return ONLY valid JSON. No markdown wrappers (\`\`\`json) or conversational text.

Raw Text to Parse:
`

async function handlePost(request: NextRequest) {
  try {
    const { rawText } = await request.json()

    if (!rawText || rawText.trim() === '') {
      return apiError('Raw text is required for parsing', 400)
    }

    if (!process.env.GEMINI_API_KEY) {
      return apiError('Gemini API key is not configured on the server', 500)
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptTemplate + rawText,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temperature for factual extraction
      }
    })

    const resultText = response.text
    if (!resultText) {
      return apiError('AI returned an empty response', 500)
    }
    
    // Fallback if the AI accidentally wrapped it in markdown despite instructions
    const cleanedText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    
    try {
      const parsedData = JSON.parse(cleanedText)
      // Ensure it's an array
      const studentsArray = Array.isArray(parsedData) ? parsedData : [parsedData]
      
      return apiSuccess({
        count: studentsArray.length,
        students: studentsArray
      }, 'Parsed successfully')
    } catch (parseErr) {
      console.error('Failed to parse AI response as JSON:', cleanedText)
      return apiError('Failed to parse the extracted data', 500)
    }
    
  } catch (error) {
    console.error('AI Parsing Error:', error)
    return handleApiError(error)
  }
}

export const POST = withSecurity(handlePost, { rateLimit: { limit: 20, windowMs: 60000 } })
