
'use server';
/**
 * @fileOverview A flow to generate description, placeholder, and default value for a given parameter.
 *
 * - generateParameterHelptext - A function that generates help text for a parameter.
 * - GenerateParameterHelptextInput - The input type for the generateParameterHelptext function.
 * - GenerateParameterHelptextOutput - The return type for the generateParameterHelptext function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateParameterHelptextInputSchema = z.object({
  parameterName: z.string().describe('The name of the parameter (e.g., TOPIC, MAX_WORDS).'),
  parameterDescription: z.string().describe('Contextual description of how this parameter is used in the task.'),
});
export type GenerateParameterHelptextInput = z.infer<typeof GenerateParameterHelptextInputSchema>;

const GenerateParameterHelptextOutputSchema = z.object({
  description: z.string().describe('A clear, concise description for the task creator explaining what this parameter is for and how to use it. This will be shown as help text in the UI.'),
  placeholder: z.string().describe('A short, exemplary placeholder value or instruction for the input field (e.g., "Enter a common noun", "e.g., cats, weather, technology").'),
  defaultValue: z.string().optional().describe('A sensible default value for this parameter, if applicable. Leave empty if no default is appropriate.'),
});
export type GenerateParameterHelptextOutput = z.infer<typeof GenerateParameterHelptextOutputSchema>;

export async function generateParameterHelptext(input: GenerateParameterHelptextInput): Promise<GenerateParameterHelptextOutput> {
  return generateParameterHelptextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateParameterHelptextPrompt',
  input: {schema: GenerateParameterHelptextInputSchema},
  output: {schema: GenerateParameterHelptextOutputSchema},
  prompt: `You are an AI assistant helping exam task creators define parameters for their tasks.
Your goal is to provide clear and helpful information for each parameter.

Parameter Name: {{{parameterName}}}
Contextual Description: {{{parameterDescription}}}

Based on the parameter name and its context, please generate:
1.  **Description:** A clear explanation of what this parameter represents and how it influences the task. This text will guide the task creator.
2.  **Placeholder:** A short, instructive placeholder for the input field where the task creator will set this parameter's value. This should give an example or a hint.
3.  **Default Value (Optional):** A sensible default value for this parameter. If a default isn't appropriate, leave this blank or provide an empty string.

Ensure the output is in the specified JSON format.
`,
});

const generateParameterHelptextFlow = ai.defineFlow(
  {
    name: 'generateParameterHelptextFlow',
    inputSchema: GenerateParameterHelptextInputSchema,
    outputSchema: GenerateParameterHelptextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
