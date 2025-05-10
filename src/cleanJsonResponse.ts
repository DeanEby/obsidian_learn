// Function to clean API response and extract valid JSON
export function cleanJsonResponse(response: string): string {
	// Remove markdown code block indicators
	let cleaned = response.trim();

	// Remove ```json or ``` from the beginning
	if (cleaned.startsWith("```json")) {
		cleaned = cleaned.substring(7).trim();
	} else if (cleaned.startsWith("```")) {
		cleaned = cleaned.substring(3).trim();
	}

	// Remove ``` from the end
	if (cleaned.endsWith("```")) {
		cleaned = cleaned.substring(0, cleaned.length - 3).trim();
	}

	// Try to find JSON object or array
	let jsonStartIndex = -1;
	let jsonEndIndex = -1;

	// Check for array
	if (cleaned.includes('[') && cleaned.includes(']')) {
		jsonStartIndex = cleaned.indexOf('[');
		jsonEndIndex = cleaned.lastIndexOf(']');
	}
	// Check for object if array wasn't found or is potentially part of a larger object
	if (cleaned.includes('{') && cleaned.includes('}') &&
		(jsonStartIndex === -1 || cleaned.indexOf('{') < jsonStartIndex)) {
		jsonStartIndex = cleaned.indexOf('{');
		jsonEndIndex = cleaned.lastIndexOf('}');
	}

	if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
		cleaned = cleaned.substring(jsonStartIndex, jsonEndIndex + 1);
	}

	return cleaned;
}
