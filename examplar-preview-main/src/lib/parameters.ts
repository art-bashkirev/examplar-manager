
import type { ExamTaskParameter } from '@/types/database.types';
import { generateParameterHelptext } from '@/ai/flows/generate-parameter-helptext';

const PARAMETER_REGEX = /{([A-Z0-9_]+)}/g;

export function extractParameterNames(text: string): string[] {
  const matches = text.matchAll(PARAMETER_REGEX);
  const names = new Set<string>();
  for (const match of matches) {
    names.add(match[1]);
  }
  return Array.from(names);
}

export function combineAndExtractUniqueParameterNames(...texts: (string | null | undefined)[]): string[] {
  const allNames = new Set<string>();
  for (const text of texts) {
    if (text) {
      const names = extractParameterNames(text);
      names.forEach(name => allNames.add(name));
    }
  }
  return Array.from(allNames);
}

export async function generateHelpForParameter(
  parameterName: string,
  taskContextDescription: string = `A parameter named ${parameterName} used in task instructions.`
): Promise<Pick<ExamTaskParameter, 'description' | 'placeholder' | 'default_value'>> {
  try {
    const result = await generateParameterHelptext({
      parameterName,
      parameterDescription: taskContextDescription, // Pass more context if needed
    });
    return {
      description: result.description,
      placeholder: result.placeholder,
      default_value: result.defaultValue,
    };
  } catch (error) {
    console.error(`Failed to generate help text for ${parameterName}:`, error);
    return {
      description: `Could not generate help text for ${parameterName}. Please provide a relevant description.`,
      placeholder: `e.g., for ${parameterName}`,
      default_value: "",
    };
  }
}
